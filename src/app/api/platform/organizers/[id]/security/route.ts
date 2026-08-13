import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeCredentialStatus, requirePlatformAdmin, resetOfficePassword, unlockOfficeUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("STATUS"),userId:z.string().min(1)}),
  z.object({action:z.literal("UNLOCK"),userId:z.string().min(1)}),
  z.object({action:z.literal("SET_PASSWORD"),userId:z.string().min(1),password:z.string().min(10).max(128)}),
]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  await requirePlatformAdmin();
  const {id}=await params;
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"INVALID_REQUEST",details:parsed.error.flatten()},{status:400});

  const user=await db.user.findFirst({where:{id:parsed.data.userId,organizationId:id}});
  if(!user)return NextResponse.json({error:"USER_NOT_FOUND"},{status:404});

  if(parsed.data.action==="STATUS"){
    const status=await getOfficeCredentialStatus(user.id);
    return NextResponse.json({ok:true,action:"STATUS",userId:user.id,email:user.email,status});
  }

  if(parsed.data.action==="UNLOCK"){
    const status=await unlockOfficeUser(user.id);
    return NextResponse.json({ok:true,action:"UNLOCK",userId:user.id,email:user.email,status});
  }

  const status=await resetOfficePassword(user.id,parsed.data.password);
  return NextResponse.json({ok:true,action:"SET_PASSWORD",userId:user.id,email:user.email,status});
}
