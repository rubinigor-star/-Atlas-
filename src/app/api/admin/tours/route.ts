import {NextResponse} from "next/server";
import {z} from "zod";
import {randomUUID} from "crypto";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth";
import {writeAudit} from "@/lib/audit";

const schema=z.object({title:z.string().min(3).max(160),slug:z.string().regex(/^[a-z0-9-]+$/),description:z.string().min(10),posterUrl:z.string().url().optional().or(z.literal("")),eventIds:z.array(z.string()).min(2)});

async function ensureTables(){
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS tour (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL, posterurl TEXT, organizationid TEXT NOT NULL, createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS tourevent (id TEXT PRIMARY KEY, tourid TEXT NOT NULL, eventid TEXT NOT NULL UNIQUE, position INTEGER NOT NULL DEFAULT 0, createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tourevent_tourid_idx ON tourevent(tourid, position)`);
}

export async function POST(req:Request){
  try{
    const actor=await requirePermission("EVENT_MANAGE");
    const input=schema.parse(await req.json());
    if(!actor.organizationId)throw new Error("Организация не настроена");
    const count=await db.event.count({where:{id:{in:input.eventIds},organizationId:actor.organizationId}});
    if(count!==input.eventIds.length)throw new Error("Часть мероприятий недоступна");
    await ensureTables();
    const id=`tour_${randomUUID().replace(/-/g,"")}`;
    await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe(`INSERT INTO tour (id,slug,title,description,posterurl,organizationid,createdat,updatedat) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,id,input.slug,input.title,input.description,input.posterUrl||null,actor.organizationId!);
      for(const [position,eventId] of input.eventIds.entries())await tx.$executeRawUnsafe(`INSERT INTO tourevent (id,tourid,eventid,position,createdat) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)`,`te_${randomUUID().replace(/-/g,"")}`,id,eventId,position);
    });
    await writeAudit(actor,{action:"TOUR_CREATED",entityType:"Tour",entityId:id,summary:`Создан тур ${input.title}`,metadata:{slug:input.slug,eventIds:input.eventIds}});
    return NextResponse.json({id,slug:input.slug},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Не удалось создать тур"},{status:400});}
}
