import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const schema=z.object({eventId:z.string().min(1),code:z.string().regex(/^[A-Za-z0-9_-]{3,32}$/),discountPercent:z.number().int().min(1).max(100)});

export async function POST(req:Request){
  try{
    const input=schema.parse(await req.json());
    const actor=await requireEventAccess("EVENT_MANAGE",input.eventId);
    const promo=await db.promoCode.create({data:{eventId:input.eventId,code:input.code.toUpperCase(),discountPercent:input.discountPercent,active:true}});
    await writeAudit(actor,{action:"PROMO_CODE_CREATE",entityType:"PromoCode",entityId:promo.id,summary:`Создан промокод ${promo.code} (${promo.discountPercent}%)`});
    return NextResponse.json({ok:true,id:promo.id},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    const duplicate=message.includes("Unique constraint");
    return NextResponse.json({error:duplicate?"Такой промокод уже существует для этого мероприятия":message},{status:400});
  }
}
