import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkinSchema } from "@/lib/schemas";
import { requirePermission, canAccessEvent } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const staff = await requirePermission("SCAN");
    const { code } = checkinSchema.parse(await req.json());
    const ticket = await db.ticket.findUnique({ where: { publicCode: code }, include: { order: { include: { event: true } } } });
    const visible = ticket && ticket.order.event.organizationId === staff.organizationId && canAccessEvent(staff, ticket.order.eventId) ? ticket : null;
    const result = await db.$transaction(async (tx) => {
      if (!visible) { await tx.scan.create({ data: { result: "NOT_FOUND" } }); return { status: "NOT_FOUND" as const, message: "Билет с таким кодом не найден" }; }
      if (visible.status === "CANCELLED") { await tx.scan.create({ data: { result: "CANCELLED", ticketId: visible.id } }); return { status: "CANCELLED" as const, message: "Билет был аннулирован" }; }
      if (visible.status === "USED") { await tx.scan.create({ data: { result: "USED", ticketId: visible.id } }); return { status: "USED" as const, message: "Этот билет уже был использован" }; }
      const claimed = await tx.ticket.updateMany({ where: { id: visible.id, status: "VALID" }, data: { status: "USED" } });
      if (claimed.count !== 1) { await tx.scan.create({ data: { result: "USED", ticketId: visible.id } }); return { status: "USED" as const, message: "Билет уже использован другим устройством" }; }
      await tx.scan.create({ data: { result: "VALID", ticketId: visible.id } });
      return { status: "VALID" as const, message: "Вход разрешён" };
    });
    await writeAudit(staff,{action:`CHECKIN_${result.status}`,entityType:"Ticket",entityId:visible?.id,summary:`Сканирование: ${result.message}`,metadata:{code:code.slice(0,8)}});
    const allowedEvents=staff.eventAccess.map(item=>item.eventId);
    const entered=await db.ticket.count({where:{status:"USED",order:{event:{organizationId:staff.organizationId!},...(allowedEvents.length?{eventId:{in:allowedEvents}}:{})}}});
    return NextResponse.json({...result,entered,scannedAt:new Date().toISOString()});
  } catch (error) {
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({status:"NOT_FOUND",message:message==="FORBIDDEN"?"Недостаточно прав":message,entered:0,scannedAt:new Date().toISOString()},{status:message==="FORBIDDEN"?403:400});
  }
}
