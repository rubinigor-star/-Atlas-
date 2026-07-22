import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { rolePermissions } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const schema=z.object({name:z.string().min(2),email:z.string().email(),jobTitle:z.string().max(100).optional(),staffRole:z.enum(["ADMIN","EVENT_MANAGER","APPROVER","CHECKIN","ANALYST","CUSTOM"])});
export async function POST(request:Request){try{const actor=await requirePermission("TEAM_MANAGE");const input=schema.parse(await request.json());const staff=await db.user.create({data:{name:input.name,email:input.email.toLowerCase(),jobTitle:input.jobTitle||null,role:input.staffRole==="CHECKIN"?"CHECKIN":"ORGANIZER",staffRole:input.staffRole,organizationId:actor.organizationId!,permissions:{create:rolePermissions[input.staffRole].map(permission=>({permission}))}},include:{permissions:true,eventAccess:true}});await writeAudit(actor,{action:"TEAM_MEMBER_CREATED",entityType:"User",entityId:staff.id,summary:`Добавлен сотрудник ${staff.name}`});return NextResponse.json({staff:{id:staff.id,name:staff.name,email:staff.email,jobTitle:staff.jobTitle,staffRole:staff.staffRole,active:staff.active,permissions:staff.permissions.map(grant=>grant.permission),eventIds:[]}})}catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400})}}
