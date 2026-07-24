import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendOrderRejectionEmail, sendOrderTicketEmail } from "@/lib/order-email";
import { captureTestAuthorization, voidTestAuthorization } from "@/lib/payment-authorization";
import { commitReservation, releaseReservation } from "@/lib/reservation";
import { cancelOrderTickets, issueTicketsForOrder } from "@/lib/ticket-engine";
import { parseEventRejectionMessage } from "@/lib/event-approval-message";

const reviewSchema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const input = reviewSchema.parse(await req.json());
    const target = await db.order.findUnique({ where: { publicId }, select: { id: true, eventId: true, customerName: true } });
    if (!target) throw new Error("Заявка не найдена");
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);

    const order = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { publicId }, include: { event: { select: { description: true } }, items: { include: { table: true, seat: true } }, tickets: true } });
      if (!current) throw new Error("Заявка не найдена");
      if (current.status !== "PENDING_APPROVAL") throw new Error("Эта заявка уже рассмотрена");

      if (input.action === "reject") {
        await releaseReservation(current.id, tx);
        await voidTestAuthorization(current.id, tx);
        await cancelOrderTickets(current.id, tx);
        const rejectionMessage = parseEventRejectionMessage(current.event.description);
        return tx.order.update({ where: { id: current.id }, data: { status: "REJECTED", reviewNote: input.note?.trim() || rejectionMessage, reviewedAt: new Date() } });
      }

      await commitReservation(current.id, tx);
      await captureTestAuthorization(current.id, tx);
      for (const item of current.items) {
        const category = await tx.ticketCategory.findUnique({ where: { eventId_name: { eventId: current.eventId, name: item.categoryName } } });
        if (!category || category.sold + item.quantity > category.capacity) throw new Error(`Недостаточно мест в категории ${item.categoryName}`);
        if (item.seatId) {
          const claimed = await tx.seat.updateMany({ where: { id: item.seatId, status: "AVAILABLE" }, data: { status: "RESERVED" } });
          if (claimed.count !== 1) throw new Error("Выбранное место уже занято");
        } else if (item.tableId) {
          const claimed = await tx.table.updateMany({ where: { id: item.tableId, reserved: false }, data: { reserved: true } });
          if (claimed.count !== 1) throw new Error("Выбранный стол уже занят");
        }
        await tx.ticketCategory.update({ where: { id: category.id }, data: { sold: { increment: item.quantity } } });
      }

      const paid = await tx.order.update({ where: { id: current.id }, data: { status: "PAID", reviewNote: input.note || null, reviewedAt: new Date(), paymentDueAt: null } });
      await issueTicketsForOrder(current.id, tx);
      return paid;
    });

    await writeAudit(actor,{ action:input.action === "approve" ? "REQUEST_APPROVED_AND_CAPTURED" : "REQUEST_REJECTED_AND_VOIDED", entityType:"Order", entityId:target.id, summary:`${input.action === "approve" ? "Одобрена и оплачена" : "Отклонена и добавлена в лист ожидания"} заявка ${target.customerName}`, metadata:{publicId} });

    let emailSent = false;
    let emailError: string | undefined;
    try {
      if (order.status === "PAID") { await sendOrderTicketEmail(publicId); emailSent = true; }
      else if (order.status === "REJECTED") { await sendOrderRejectionEmail(publicId); emailSent = true; }
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Ошибка отправки уведомления";
    }

    return NextResponse.json({ status: order.status, emailSent, emailError });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка проверки заявки" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 });
  }
}
