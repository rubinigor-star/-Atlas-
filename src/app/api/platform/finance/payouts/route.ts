import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureFinanceRuntime, financeEvents } from "@/lib/finance";

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
      // Serialize financial writes for the same event. This prevents two tabs or
      // two rapid requests from both passing the same available-balance check.
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`,event.id);
      const finance=(await financeEvents(event.organizationId)).find(item=>item.eventId===event.id);
      if(!finance)throw new Error("По мероприятию пока нет финансовых операций");
      if(finance.availableMinor<=0)throw new Error("По этому мероприятию сейчас нет суммы, доступной к выплате");
      if(input.amountMinor>finance.availableMinor)throw new Error(`Нельзя зафиксировать выплату больше доступного остатка: ${(finance.availableMinor/100).toFixed(2)} ₪`);

      const id=`payout_${randomUUID().replace(/-/g,"")}`;
      await tx.$executeRawUnsafe(
        `INSERT INTO "OrganizerPayout" ("id","organizationId","eventId","amountMinor","status","paidAt","reference","createdAt") VALUES ($1,$2,$3,$4,'PAID',CURRENT_TIMESTAMP,$5,CURRENT_TIMESTAMP)`,
        id,event.organizationId,event.id,input.amountMinor,input.reference||null,
      );
      return {id,availableBefore:finance.availableMinor};
    });

    return NextResponse.json({ok:true,id:result.id,amountMinor:input.amountMinor,eventId:event.id});
  }catch(error){
    const message=error instanceof Error?error.message:"Не удалось зафиксировать выплату";
    console.error("[platform-finance-payout]",{message});
    return NextResponse.json({error:message},{status:400});
  }
}
