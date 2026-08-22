import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { enqueueOrderReview, processOrderReviewJobs } from "@/lib/order-review-queue";
import { releaseReservation } from "@/lib/reservation";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("cancel") }),
]);

type AuthorizationRow={status:string;amountMinor:number;capturedAt:Date|null};
const copy={
  ru:{notRequest:"Этот заказ не относится к заявкам",requestMissing:"Заявка не найдена",dismissState:"Удалить из очереди можно только отменённую или отклонённую заявку",ticketsIssued:"Заявку с выпущенными билетами нельзя удалить из очереди",dismissFailed:"Не удалось удалить заявку из очереди",orderMissing:"Заказ не найден",used:"Нельзя отменить заказ после прохода по билету",refundRequired:"По этому заказу были списаны деньги. Используйте возврат средств, а не обычную отмену.",forbidden:"Недостаточно прав",failed:"Не удалось обработать заказ"},
  he:{notRequest:"ההזמנה הזו אינה בקשה לאישור",requestMissing:"הבקשה לא נמצאה",dismissState:"ניתן להסיר מהתור רק בקשה שבוטלה או נדחתה",ticketsIssued:"לא ניתן להסיר מהתור בקשה שכבר הופקו עבורה כרטיסים",dismissFailed:"לא ניתן להסיר את הבקשה מהתור",orderMissing:"ההזמנה לא נמצאה",used:"לא ניתן לבטל הזמנה לאחר שכרטיס כבר מומש",refundRequired:"ההזמנה כבר חויבה. יש לבצע החזר כספי במקום ביטול רגיל.",forbidden:"אין הרשאה מתאימה",failed:"לא ניתן לעבד את ההזמנה"},
  en:{notRequest:"This order is not an approval request",requestMissing:"Request not found",dismissState:"Only cancelled or rejected requests can be removed from the queue",ticketsIssued:"A request with issued tickets cannot be removed from the queue",dismissFailed:"Could not remove the request from the queue",orderMissing:"Order not found",used:"An order cannot be cancelled after a ticket has been used",refundRequired:"This order has already been charged. Use a refund instead of a regular cancellation.",forbidden:"Insufficient permission",failed:"Could not process the order"}
} as const;
function staffLocale(actor:Awaited<ReturnType<typeof requireEventAccess>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}
function localizeError(error:unknown,locale:Locale,fallback:"dismissFailed"|"failed"){const raw=error instanceof Error?error.message:"";const c=copy[locale];if(raw==="FORBIDDEN")return c.forbidden;if(raw.includes("не относится к заявкам"))return c.notRequest;if(raw==="Заявка не найдена")return c.requestMissing;if(raw.includes("Удалить из очереди"))return c.dismissState;if(raw.includes("выпущенными билетами"))return c.ticketsIssued;if(raw==="Заказ не найден")return c.orderMissing;if(raw.includes("после прохода по билету"))return c.used;if(raw.includes("были списаны деньги"))return c.refundRequired;return c[fallback];}

async function assertApprovalOrder(orderId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ salesFlow: string }>>(`SELECT "salesFlow" FROM "Order" WHERE "id"=$1 LIMIT 1`,orderId);
  if (rows[0]?.salesFlow !== "APPROVAL") throw new Error("Этот заказ не относится к заявкам");
}

export async function DELETE(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  let locale:Locale="ru";
  try {
    const target = await db.order.findUnique({where: { publicId },select: { id: true, eventId: true, customerName: true, status: true, _count: { select: { tickets: true } } }});
    if (!target) throw new Error("Заявка не найдена");
    await assertApprovalOrder(target.id);
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);locale=staffLocale(actor);
    if (target.status !== "CANCELLED" && target.status !== "REJECTED") throw new Error("Удалить из очереди можно только отменённую или отклонённую заявку");
    if (target._count.tickets > 0) throw new Error("Заявку с выпущенными билетами нельзя удалить из очереди");
    await db.order.update({where: { id: target.id },data: { reviewNote: DISMISSED_EXPIRED_NOTE, reviewedAt: new Date(), paymentDueAt: null }});
    await writeAudit(actor, {action: "REQUEST_DISMISSED",entityType: "Order",entityId: target.id,summary: "REQUEST_DISMISSED",metadata: { publicId, customerName: target.customerName }});
    return NextResponse.json({ status: target.status, dismissed: true });
  } catch (error) {
    console.error("admin.request.dismiss_failed",{publicId,message:error instanceof Error?error.message:"UNKNOWN"});
    return NextResponse.json({ error: localizeError(error,locale,"dismissFailed") },{ status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  let locale:Locale="ru";
  try {
    const input = actionSchema.parse(await req.json());
    if(input.action==="cancel"){
      const target=await db.order.findUnique({where:{publicId},include:{items:true,tickets:true}});if(!target)throw new Error("Заказ не найден");
      const actor=await requireEventAccess("ORDER_MANAGE",target.eventId);locale=staffLocale(actor);
      if(target.status==="CANCELLED"||target.status==="REJECTED")return NextResponse.json({ok:true,status:target.status});
      if(target.tickets.some(ticket=>ticket.status==="USED"))throw new Error("Нельзя отменить заказ после прохода по билету");
      const authorization=await db.$queryRaw<AuthorizationRow[]>`SELECT status,"amountMinor","capturedAt" FROM "PaymentAuthorization" WHERE "orderId"=${target.id} LIMIT 1`.then(rows=>rows[0]);
      if(target.totalMinor>0&&(authorization?.capturedAt||target.status==="PAID"))throw new Error("По этому заказу были списаны деньги. Используйте возврат средств, а не обычную отмену.");
      const activeTickets=target.tickets.filter(ticket=>ticket.status!=="CANCELLED");const categoryCounts=new Map<string,number>();for(const ticket of activeTickets)categoryCounts.set(ticket.categoryId,(categoryCounts.get(ticket.categoryId)||0)+1);const seatIds=target.items.map(item=>item.seatId).filter((id):id is string=>Boolean(id));
      await db.$transaction(async tx=>{await releaseReservation(target.id,tx);await tx.ticket.updateMany({where:{orderId:target.id,status:{not:"CANCELLED"}},data:{status:"CANCELLED"}});await tx.order.update({where:{id:target.id},data:{status:"CANCELLED",paymentDueAt:null}});for(const [categoryId,count] of categoryCounts)await tx.ticketCategory.updateMany({where:{id:categoryId,sold:{gte:count}},data:{sold:{decrement:count}}});if(seatIds.length)await tx.seat.updateMany({where:{id:{in:seatIds},status:"RESERVED"},data:{status:"AVAILABLE"}});});
      await writeAudit(actor,{action:"ORDER_CANCELLED_NO_REFUND",entityType:"Order",entityId:target.id,summary:"ORDER_CANCELLED_NO_REFUND",metadata:{publicId,totalMinor:target.totalMinor,authorizationStatus:authorization?.status??null}});
      return NextResponse.json({ok:true,status:"CANCELLED"});
    }

    const target = await db.order.findUnique({ where: { publicId }, select: { id: true, eventId: true } });if (!target) throw new Error("Заявка не найдена");await assertApprovalOrder(target.id);
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);locale=staffLocale(actor);const job = await enqueueOrderReview(publicId, input, actor);
    after(async () => {try {await processOrderReviewJobs(3);} catch (error) {console.error("admin.request.background_queue_failed", {publicId,message: error instanceof Error ? error.message : "UNKNOWN_QUEUE_ERROR"});}});
    return NextResponse.json({queued: true,processing: true,jobId: job.id,action: job.action,status: job.action === "approve" ? "PROCESSING_APPROVE" : "PROCESSING_REJECT"},{ status: 202 });
  } catch (error) {
    const current = await db.order.findUnique({ where: { publicId }, select: { status: true } }).catch(() => null);
    console.error("admin.request.action_failed", {publicId,message: error instanceof Error ? error.message : "UNKNOWN_ERROR",status: current?.status || null});
    return NextResponse.json({ error: localizeError(error,locale,"failed"), status: current?.status },{ status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 });
  }
}
