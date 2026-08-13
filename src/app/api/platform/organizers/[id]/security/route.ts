import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeCredentialStatus, requirePlatformAdmin, resetOfficePassword, unlockOfficeUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("STATUS")}),
  z.object({action:z.literal("UNLOCK")}),
  z.object({action:z.literal("SET_PASSWORD"),password:z.string().min(10).max(128)}),
]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  await requirePlatformAdmin();
  const {id}=await params;
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"INVALID_REQUEST",details:parsed.error.flatten()},{status:400});

  const organization=await db.organization.findUnique({where:{id},include:{users:true}});
  if(!organization)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const owner=organization.users.find(user=>user.staffRole==="OWNER")??organization.users[0];
  if(!owner)return NextResponse.json({error:"OWNER_NOT_FOUND"},{status:409});

  if(parsed.data.action==="STATUS"){
    const status=await getOfficeCredentialStatus(owner.id);
    return NextResponse.json({ok:true,action:"STATUS",userId:owner.id,email:owner.email,status});
  }

  if(parsed.data.action==="UNLOCK"){
    const status=await unlockOfficeUser(owner.id);
    return NextResponse.json({ok:true,action:"UNLOCK",userId:owner.id,email:owner.email,status});
  }

  const status=await resetOfficePassword(owner.id,parsed.data.password);
  return NextResponse.json({ok:true,action:"SET_PASSWORD",userId:owner.id,email:owner.email,status});
}
