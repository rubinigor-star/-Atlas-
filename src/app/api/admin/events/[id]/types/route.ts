import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { eventTypeValues,withEventTypes } from "@/lib/event-type";

const schema=z.object({eventTypes:z.array(z.enum(eventTypeValues)).min(1).max(eventTypeValues.length)});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{const{id}=await params;await requireEventAccess("EVENT_MANAGE",id);const value=schema.parse(await req.json());const current=await db.event.findUniqueOrThrow({where:{id},select:{description:true}});await db.event.update({where:{id},data:{description:withEventTypes(current.description,value.eventTypes)}});return NextResponse.json({ok:true});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка"},{status:400});}
}
