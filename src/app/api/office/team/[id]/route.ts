import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOfficeCredentialStatus, requirePermission, setStaffEventScope } from "@/lib/auth";
import { allPermissions, rolePermissions } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { sendOrganizerPasswordReset, sendStaffInvitation } from "@/lib/office-auth-email";

const schema=z.object({staffRole:z.enum(["ADMIN","EVENT_MANAGER","APPROVER","CHECKIN","ANALYST","CUSTOM"]),jobTitle:z.string().max(100).nullable().optional(),interfaceLocaleOverride:z.enum(["ru","he","en"]).nullable(),active:z.boolean(),permissions:z.array(z.enum(allPermissions as [typeof allPermissions[number],...typeof allPermissions])),eventIds:z.array(z.string()).max(100),eventScope:z.enum(["ALL","SELECTED","NONE"])});

async function editableMember(actor:Awaited<ReturnType<typeof requirePermission>>,id:string){
  const member=await db.user.findUniqueOrThrow({where:{id},include:{permissions:true,eventAccess:true}});
  if(member.organizationId!==actor.organizationId)throw new Error("Сотрудник другой организации");
  if(member.id===actor.id)throw new Error("Нельзя выполнять это действие со своим аккаунтом из текущей сессии");
  if(member.staffRole==="OWNER")throw new Error("Владелец защищён. Передача владения выполняется отдельной операцией");
  if(member.staffRole==="ADMIN"&&actor.staffRole!=="OWNER")throw new Error("Только владелец может управлять администраторами");
  return member;
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requirePermission("TEAM_MANAGE");
    const {id}=await params;
    const input=schema.parse(await request.json());
    const member=await editableMember(actor,id);
    const actorIsOwner=actor.staffRole==="OWNER";
    if(input.staffRole==="ADMIN"&&!actorIsOwner)throw new Error("Только владелец может управлять администраторами");
    const resolvedPermissions=input.staffRole==="CUSTOM"?input.permissions:rolePermissions[input.staffRole];
    if(!actorIsOwner&&resolvedPermissions.includes("TEAM_MANAGE"))throw new Error("Только владелец может выдавать право управления командой");
    if(input.eventScope==="SELECTED"&&input.eventIds.length===0)throw new Error("Выберите хотя бы одно мероприятие или установите другой режим доступа");
    const eventIds=input.eventScope==="SELECTED"?[...new Set(input.eventIds)]:[];
    if(eventIds.length){const eventCount=await db.event.count({where:{id:{in:eventIds},organizationId:actor.organizationId!}});if(eventCount!==eventIds.length)throw new Error("Некоторые мероприятия недоступны");}
    await db.$transaction(async tx=>{
      await tx.permissionGrant.deleteMany({where:{userId:id}});
      await tx.eventStaffAccess.deleteMany({where:{userId:id}});
      await tx.user.update({where:{id},data:{staffRole:input.staffRole,jobTitle:input.jobTitle?.trim()||null,interfaceLocaleOverride:input.interfaceLocaleOverride,active:input.active,role:input.staffRole==="CHECKIN"?"CHECKIN":"ORGANIZER",permissions:{create:resolvedPermissions.map(permission=>({permission}))},eventAccess:{create:eventIds.map(eventId=>({eventId}))}}});
    });
    await setStaffEventScope(id,input.eventScope);
    await writeAudit(actor,{action:"TEAM_PERMISSIONS_UPDATED",entityType:"User",entityId:id,summary:`Изменены права сотрудника ${member.name}`,metadata:{staffRole:input.staffRole,interfaceLocaleOverride:input.interfaceLocaleOverride,permissions:resolvedPermissions,eventIds,eventScope:input.eventScope,active:input.active}});
    return NextResponse.json({ok:true});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});
  }
}

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requirePermission("TEAM_MANAGE");
    const {id}=await params;
    const member=await editableMember(actor,id);
    if(!member.active)throw new Error("Сначала включите доступ сотруднику и сохраните изменения");
    const credential=await getOfficeCredentialStatus(member.id);
    if(credential.exists){
      await sendOrganizerPasswordReset(member.id,member.email);
      await writeAudit(actor,{action:"TEAM_ACCESS_EMAIL_RESENT",entityType:"User",entityId:id,summary:`Отправлено восстановление доступа сотруднику ${member.name}`,metadata:{mode:"RESET"}});
      return NextResponse.json({ok:true,mode:"RESET"});
    }
    await sendStaffInvitation(member.id,member.email,actor.organization?.name||"Atlas One");
    await writeAudit(actor,{action:"TEAM_ACCESS_EMAIL_RESENT",entityType:"User",entityId:id,summary:`Повторно отправлено приглашение сотруднику ${member.name}`,metadata:{mode:"INVITE"}});
    return NextResponse.json({ok:true,mode:"INVITE"});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});
  }
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requirePermission("TEAM_MANAGE");
    const {id}=await params;
    const member=await editableMember(actor,id);
    await writeAudit(actor,{action:"TEAM_MEMBER_DELETED",entityType:"User",entityId:id,summary:`Удалён сотрудник ${member.name}`,metadata:{email:member.email,staffRole:member.staffRole}});
    await db.$transaction(async tx=>{
      await tx.permissionGrant.deleteMany({where:{userId:id}});
      await tx.eventStaffAccess.deleteMany({where:{userId:id}});
      await tx.user.delete({where:{id}});
    });
    await db.$executeRawUnsafe(`DELETE FROM "OfficeCredential" WHERE "userId"=$1`,id).catch(()=>undefined);
    await db.$executeRawUnsafe(`DELETE FROM "StaffEventScope" WHERE "userId"=$1`,id).catch(()=>undefined);
    return NextResponse.json({ok:true});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});
  }
}
