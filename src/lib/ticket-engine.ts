import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ticketCode } from "@/lib/ticketing";

type Executor = typeof db | Prisma.TransactionClient;

export type TicketValidationResult =
  | { result: "VALID"; ticketId: string; eventId: string; holderName: string; categoryName: string }
  | { result: "USED" | "CANCELLED" | "NOT_FOUND"; ticketId?: string };

export async function issueTicketsForOrder(orderId: string, executor: Executor = db) {
  const current = await executor.order.findUnique({
    where: { id: orderId },
    include: { items: true, tickets: true },
  });
  if (!current) throw new Error("Заказ не найден");
  if (current.status !== "PAID") throw new Error("Билеты можно выпустить только после оплаты");
  if (current.tickets.length) return current.tickets;

  for (const item of current.items) {
    const category = await executor.ticketCategory.findUnique({
      where: { eventId_name: { eventId: current.eventId, name: item.categoryName } },
    });
    if (!category) throw new Error(`Категория ${item.categoryName} не найдена`);
    await executor.ticket.createMany({
      data: Array.from({ length: item.quantity }, () => ({
        publicCode: ticketCode(),
        holderName: current.customerName,
        categoryId: category.id,
        orderId: current.id,
      })),
    });
  }

  return executor.ticket.findMany({ where: { orderId: current.id }, orderBy: { createdAt: "asc" } });
}

export async function cancelOrderTickets(orderId: string, executor: Executor = db) {
  return executor.ticket.updateMany({
    where: { orderId, status: { in: ["VALID", "USED"] } },
    data: { status: "CANCELLED", walletUpdatedAt: new Date() },
  });
}

export async function validateAndUseTicket(publicCode: string): Promise<TicketValidationResult> {
  return db.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { publicCode },
      include: { category: true, order: { select: { eventId: true, status: true } } },
    });

    if (!ticket) {
      await tx.scan.create({ data: { result: "NOT_FOUND" } });
      return { result: "NOT_FOUND" };
    }

    if (ticket.status !== "VALID" || ticket.order.status !== "PAID") {
      const result = ticket.status === "USED" ? "USED" : "CANCELLED";
      await tx.scan.create({ data: { result, ticketId: ticket.id } });
      return { result, ticketId: ticket.id };
    }

    const claimed = await tx.ticket.updateMany({
      where: { id: ticket.id, status: "VALID" },
      data: { status: "USED" },
    });
    if (claimed.count !== 1) {
      await tx.scan.create({ data: { result: "USED", ticketId: ticket.id } });
      return { result: "USED", ticketId: ticket.id };
    }

    await tx.scan.create({ data: { result: "VALID", ticketId: ticket.id } });
    return {
      result: "VALID",
      ticketId: ticket.id,
      eventId: ticket.order.eventId,
      holderName: ticket.holderName,
      categoryName: ticket.category.name,
    };
  });
}
