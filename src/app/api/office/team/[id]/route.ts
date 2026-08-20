import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, setStaffEventScope } from "@/lib/auth";
import { allPermissions, rolePermissions } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const schema=z.object({staffRole:z.enum(["ADMIN","EVENT_MANAGER","APPROVER","CHECKIN","ANALYST","CUSTOM"]),jobTitle:z.string().max(100).nullable().optional(),active:z.boolean(),permissions:z.array(z.enum(allPermissions as [typeof allPermissions[number],...typeof allPermissions])),eventIds:z.array(z.string()).max(100),eventScope:z.enum(["ALL","SELECTED","NONE"])});

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requirePermission("TEAM_MANAGE");
    const {id}=await params;
    const input=schema.parse(await request.json());
    const member=await db.user.findUniqueOrThrow({where:{id},include:{permissions:true,eventAccess:true}});
    if(member.organizationId!==actor.organizationId)throw new Error("Сотрудник другой организации");
    if(member.id===actor.id)throw new Error("Нельзя менять собственные права из текущей сессии");
    if(member.staffRole==="OWNER")throw new Error("Владелец защищён. Передача владения выполняется отдельной операцией");
    const actorIsOwner=actor.staffRole==="OWNER";
    if((member.staffRole==="ADMIN"||input.staffRole==="ADMIN")&&!actorIsOwner)throw new Error("Только владелец может управлять администраторами");
    const resolvedPermissions=input.staffRole==="CUSTOM"?input.permissions:rolePermissions[input.staffRole];
    if(!actorIsOwner&&resolvedPermissions.includes("TEAM_MANAGE"))throw new Error("Только владелец может выдавать право управления командой");
    if(input.eventScope==="SELECTED"&&input.eventIds.length===0)throw new Error("Выберите хотя бы одно мероприятие или установите другой режим доступа");
    const eventIds=input.eventScope==="SELECTED"?[...new Set(input.eventIds)]:[];
    if(eventIds.length){const eventCount=await db.event.count({where:{id:{in:eventIds},organizationId:actor.organizationId!}});if(eventCount!==eventIds.length)throw new Error("Некоторые мероприятия недоступны");}
    await db.$transaction(async tx=>{
      await tx.permissionGrant.deleteMany({where:{userId:id}});
      await tx.eventStaffAccess.deleteMany({where:{userId:id}});
      await tx.user.update({where:{id},data:{staffRole:input.staffRole,jobTitle:input.jobTitle?.trim()||null,active:input.active,role:input.staffRole==="CHECKIN"?"CHECKIN":"ORGANIZER",permissions:{create:resolvedPermissions.map(permission=>({permission}))},eventAccess:{create:eventIds.map(eventId=>({eventId}))}}});
    });
    await setStaffEventScope(id,input.eventScope);
    await writeAudit(actor,{action:"TEAM_PERMISSIONS_UPDATED",entityType:"User",entityId:id,summary:`Изменены права сотрудника ${member.name}`,metadata:{staffRole:input.staffRole,permissions:resolvedPermissions,eventIds,eventScope:input.eventScope,active:input.active}});
    return NextResponse.json({ok:true});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});
  }
}
