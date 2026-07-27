import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { refundHypDeal } from "@/lib/hyp-yaadpay";
import { notifyWalletTickets } from "@/lib/wallet-push";

const schema=z.object({amountMinor:z.number().int().positive().optional(),reason:z.string().min(3).max(500)});
type AuthorizationRow={id:string;providerReference:string;amountMinor:number;status:string};

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requirePermission("ORDER_MANAGE");
  const{id}=await params;const input=schema.parse(await req.json());
  const order=await db.order.findUnique({where:{publicId:id},include:{items:true,tickets:true,event:true}});
  if(!order||order.event.organizationId!==actor.organizationId)throw new Error("Заказ не найден");
  if(order.status!=="PAID")throw new Error("Возврат возможен только для оплаченного заказа");
  const rows=await db.$queryRaw<AuthorizationRow[]>`SELECT id, "providerReference", "amountMinor", status FROM "PaymentAuthorization" WHERE "orderId"=${order.id} AND provider='HYP' LIMIT 1`;
  const authorization=rows[0];if(!authorization)throw new Error("Для заказа не найдена транзакция HYP");
  const amountMinor=input.amountMinor??order.totalMinor;
  if(amountMinor>order.totalMinor)throw new Error("Сумма возврата превышает сумму заказа");
  const full=amountMinor===order.totalMinor;
  const result=await refundHypDeal({transactionId:authorization.providerReference,amountMinor});
  await db.$transaction(async tx=>{
   await tx.$executeRaw`UPDATE "PaymentAuthorization" SET status=${full?'REFUNDED':'PARTIALLY_REFUNDED'}, "voidedAt"=CURRENT_TIMESTAMP, "failureReason"=${input.reason}, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${authorization.id}`;
   if(full){
    await tx.ticket.updateMany({where:{orderId:order.id},data:{status:"CANCELLED",walletUpdatedAt:new Date()}});
    for(const item of order.items){
     await tx.ticketCategory.updateMany({where:{eventId:order.eventId,name:item.categoryName},data:{sold:{decrement:item.quantity}}});
     if(item.tableId)await tx.table.update({where:{id:item.tableId},data:{reserved:false}});
     if(item.seatId)await tx.seat.update({where:{id:item.seatId},data:{status:"AVAILABLE"}});
    }
    await tx.order.update({where:{id:order.id},data:{status:"CANCELLED",reviewNote:`Возврат: ${input.reason}`}});
   }else await tx.order.update({where:{id:order.id},data:{reviewNote:`Частичный возврат ${(amountMinor/100).toFixed(2)} ILS: ${input.reason}`}});
  });
  if(full)await notifyWalletTickets(order.tickets.map(ticket=>ticket.id));
  await writeAudit(actor,{action:full?"ORDER_REFUNDED":"ORDER_PARTIALLY_REFUNDED",entityType:"Order",entityId:order.id,summary:`Возврат по заказу ${order.publicId}: ${(amountMinor/100).toFixed(2)} ₪`,metadata:{amountMinor,reason:input.reason,hypRefundTransactionId:result.transactionId,originalTransactionId:authorization.providerReference}});
  return NextResponse.json({ok:true,full,amountMinor,hypTransactionId:result.transactionId});
 }catch(error){const message=error instanceof Error?error.message:"Ошибка возврата";return NextResponse.json({error:message},{status:400});}
}
