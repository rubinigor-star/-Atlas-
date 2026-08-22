import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, setStaffEventScope } from "@/lib/auth";
import { rolePermissions } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { sendStaffInvitation } from "@/lib/office-auth-email";

const schema=z.object({name:z.string().min(2).max(120),email:z.string().email(),jobTitle:z.string().max(100).optional(),staffRole:z.enum(["ADMIN","EVENT_MANAGER","APPROVER","CHECKIN","ANALYST","CUSTOM"]),interfaceLocaleOverride:z.enum(["ru","he","en"]).nullable().optional()});

export async function POST(request:Request){
  try{
    const actor=await requirePermission("TEAM_MANAGE");
    if(!actor.organizationId)throw new Error("FORBIDDEN");
    const input=schema.parse(await request.json());
    const actorIsOwner=actor.staffRole==="OWNER";
    if(input.staffRole==="ADMIN"&&!actorIsOwner)throw new Error("Только владелец может назначать администраторов");
    const normalizedEmail=input.email.trim().toLowerCase();
    const existing=await db.user.findUnique({where:{email:normalizedEmail}});
    if(existing)throw new Error("Пользователь с таким email уже существует");
    const permissions=input.staffRole==="CUSTOM"?[]:rolePermissions[input.staffRole];
    const staff=await db.user.create({data:{name:input.name.trim(),email:normalizedEmail,jobTitle:input.jobTitle?.trim()||null,interfaceLocaleOverride:input.interfaceLocaleOverride??null,role:input.staffRole==="CHECKIN"?"CHECKIN":"ORGANIZER",staffRole:input.staffRole,organizationId:actor.organizationId,active:true,permissions:{create:permissions.map(permission=>({permission}))}},include:{permissions:true,eventAccess:true}});
    await setStaffEventScope(staff.id,"NONE");
    let invitationSent=false;
    try{
      invitationSent=true;
      await sendStaffInvitation(staff.id,staff.email,actor.organization?.name||"Atlas One");
    }catch(error){
      invitationSent=false;
      console.error("[staff-invite]",error);
    }
    await writeAudit(actor,{action:"TEAM_MEMBER_CREATED",entityType:"User",entityId:staff.id,summary:`Добавлен сотрудник ${staff.name}`,metadata:{staffRole:staff.staffRole,eventScope:"NONE",invitationSent}});
    return NextResponse.json({invitationSent,staff:{id:staff.id,name:staff.name,email:staff.email,jobTitle:staff.jobTitle,staffRole:staff.staffRole,interfaceLocaleOverride:staff.interfaceLocaleOverride,active:staff.active,permissions:staff.permissions.map(grant=>grant.permission),eventIds:[],eventScope:"NONE"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});
  }
}
