import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureFinanceRuntime, financeEvents, organizerFinanceSummary } from "@/lib/finance";

const schema=z.object({
  eventId:z.string().min(1),
  amountMinor:z.number().int().positive(),
  reference:z.string().trim().max(120).optional().default(""),
});

export async function POST(req:Request){
  try{
    await requirePlatformAdmin();
    await ensureFinanceRuntime();
    const input=schema.parse(await req.json());
    const event=await db.event.findUnique({where:{id:input.eventId},select:{id:true,organizationId:true,title:true}});
    if(!event)throw new Error("Мероприятие не найдено");

    const result=await db.$transaction(async tx=>{
      // Serialize payouts for the entire organizer, not only one event. A debt
      // created by refunds on event A must reduce a payout from event B.
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`,`finance-org:${event.organizationId}`);
      const events=await financeEvents(event.organizationId);
      const finance=events.find(item=>item.eventId===event.id);
      if(!finance)throw new Error("По мероприятию пока нет финансовых операций");
      const organization=await organizerFinanceSummary(event.organizationId);
      const allowedForThisEvent=Math.min(finance.availableMinor,organization.availableMinor);
      if(allowedForThisEvent<=0)throw new Error("Сейчас нет суммы, доступной к выплате с учётом возвратов и общего баланса организатора");
      if(input.amountMinor>allowedForThisEvent)throw new Error(`Нельзя зафиксировать выплату больше доступного остатка с учётом общего баланса: ${(allowedForThisEvent/100).toFixed(2)} ₪`);

      const id=`payout_${randomUUID().replace(/-/g,"")}`;
      await tx.$executeRawUnsafe(
        `INSERT INTO "OrganizerPayout" ("id","organizationId","eventId","amountMinor","status","paidAt","reference","createdAt") VALUES ($1,$2,$3,$4,'PAID',CURRENT_TIMESTAMP,$5,CURRENT_TIMESTAMP)`,
        id,event.organizationId,event.id,input.amountMinor,input.reference||null,
      );
      return {id,availableBefore:allowedForThisEvent};
    });

    return NextResponse.json({ok:true,id:result.id,amountMinor:input.amountMinor,eventId:event.id});
  }catch(error){
    const message=error instanceof Error?error.message:"Не удалось зафиксировать выплату";
    console.error("[platform-finance-payout]",{message});
    return NextResponse.json({error:message},{status:400});
  }
}
