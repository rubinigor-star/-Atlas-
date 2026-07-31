import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const schema=z.object({eventIds:z.array(z.string().min(1)).max(50).refine(ids=>new Set(ids).size===ids.length,"Мероприятия не должны повторяться")});

export async function PUT(req:Request){
  try{
    await requirePlatformAdmin();
    const {eventIds}=schema.parse(await req.json());
    const published=await db.event.findMany({where:{id:{in:eventIds},status:"PUBLISHED"},select:{id:true}});
    if(published.length!==eventIds.length)throw new Error("В списке есть неопубликованное или недоступное мероприятие");
    await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe(`DELETE FROM "HomeMarqueeEvent"`);
      for(const [index,eventId] of eventIds.entries())await tx.$executeRawUnsafe(`INSERT INTO "HomeMarqueeEvent" ("eventId","position","active","createdAt","updatedAt") VALUES ($1,$2,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,eventId,index+1);
    });
    return NextResponse.json({ok:true,count:eventIds.length});
  }catch(error){const message=error instanceof Error?error.message:"Ошибка сохранения";console.error("[platform-home-marquee]",{message});return NextResponse.json({error:message},{status:400});}
}
