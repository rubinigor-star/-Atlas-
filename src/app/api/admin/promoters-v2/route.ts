import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireEventAccess } from "@/lib/auth";
import { assignPromoterV2, createPromoterV2, getPromoterV2, listAssignmentsV2, listPromotersV2, setPromoterV2Active, setPromoterV2Automation, type PromoterEventV2Row } from "@/lib/promoter-v2";

const createSchema=z.object({action:z.literal("create"),name:z.string().trim().min(2).max(120),email:z.string().email(),phone:z.string().trim().max(40).optional().nullable(),commissionPercent:z.number().min(0).max(100).default(0),autoAssignAllEvents:z.boolean().default(false),eventIds:z.array(z.string().min(1)).default([])});
const assignSchema=z.object({action:z.literal("assign"),promoterId:z.string().min(1),eventId:z.string().min(1)});
const archiveSchema=z.object({action:z.literal("setActive"),promoterId:z.string().min(1),active:z.boolean()});
const automationSchema=z.object({action:z.literal("automation"),promoterId:z.string().min(1),value:z.boolean()});

async function actor(){const user=await requirePermission("EVENT_MANAGE");if(!user.organizationId)throw new Error("FORBIDDEN");return user}
async function ownPromoter(promoterId:string){const user=await actor();const promoter=await getPromoterV2(promoterId);if(!promoter||promoter.organizationId!==user.organizationId)throw new Error("PROMOTER_NOT_FOUND");return{user,promoter}}
async function ensureOrderReferral(assignment:PromoterEventV2Row){await db.referral.upsert({where:{code:assignment.code},create:{code:assignment.code,label:assignment.label,eventId:assignment.eventId},update:{label:assignment.label,eventId:assignment.eventId}})}

export async function GET(){
 try{const user=await actor();const promoters=await listPromotersV2(user.organizationId);return NextResponse.json({ok:true,promoters});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка"},{status:400})}
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  if(body.action==="create"){
   const input=createSchema.parse(body);const user=await actor();
   for(const eventId of input.eventIds)await requireEventAccess("EVENT_MANAGE",eventId);
   const promoter=await createPromoterV2({organizationId:user.organizationId!,name:input.name,email:input.email,phone:input.phone,defaultCommissionBps:Math.round(input.commissionPercent*100),autoAssignAllEvents:input.autoAssignAllEvents});
   const assignments=[];for(const eventId of input.eventIds){const assignment=await assignPromoterV2(promoter.id,eventId);await ensureOrderReferral(assignment);assignments.push(assignment);}
   return NextResponse.json({ok:true,promoter,assignments},{status:201});
  }
  if(body.action==="assign"){
   const input=assignSchema.parse(body);const {promoter}=await ownPromoter(input.promoterId);await requireEventAccess("EVENT_MANAGE",input.eventId);const assignment=await assignPromoterV2(promoter.id,input.eventId);await ensureOrderReferral(assignment);return NextResponse.json({ok:true,assignment},{status:201});
  }
  if(body.action==="setActive"){
   const input=archiveSchema.parse(body);await ownPromoter(input.promoterId);const promoter=await setPromoterV2Active(input.promoterId,input.active);return NextResponse.json({ok:true,promoter});
  }
  if(body.action==="automation"){
   const input=automationSchema.parse(body);await ownPromoter(input.promoterId);await setPromoterV2Automation(input.promoterId,input.value);return NextResponse.json({ok:true});
  }
  throw new Error("UNKNOWN_ACTION");
 }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message},{status:message==="FORBIDDEN"?403:message==="PROMOTER_NOT_FOUND"?404:400})}
}

export async function PUT(req:Request){
 try{const {promoterId}=z.object({promoterId:z.string().min(1)}).parse(await req.json());const {promoter}=await ownPromoter(promoterId);const assignments=await listAssignmentsV2(promoter.id);return NextResponse.json({ok:true,promoter,assignments});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка"},{status:400})}
}
