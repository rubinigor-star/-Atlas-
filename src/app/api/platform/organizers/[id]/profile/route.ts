import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateOrganizerCompliance } from "@/lib/organizer-compliance";

const schema=z.object({
  organizationName:z.string().trim().min(2).max(160),
  ownerName:z.string().trim().min(2).max(160),
  ownerEmail:z.string().trim().email().transform(value=>value.toLowerCase()),
  businessType:z.string().trim().max(120).optional().default(""),
  country:z.string().trim().max(120).optional().default(""),
  phone:z.string().trim().max(40).optional().default(""),
  bankAccountLabel:z.string().trim().max(300).optional().default(""),
  taxDocumentLabel:z.string().trim().max(500).optional().default(""),
});

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  await requirePlatformAdmin();
  const {id}=await params;
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"INVALID_DATA",details:parsed.error.flatten()},{status:400});
  const organization=await db.organization.findUnique({where:{id},include:{users:true}});
  if(!organization)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const owner=organization.users.find(user=>user.staffRole==="OWNER")??organization.users[0];
  if(!owner)return NextResponse.json({error:"OWNER_NOT_FOUND"},{status:409});
  const emailOwner=await db.user.findUnique({where:{email:parsed.data.ownerEmail}});
  if(emailOwner&&emailOwner.id!==owner.id)return NextResponse.json({error:"EMAIL_EXISTS"},{status:409});
  await db.$transaction(async tx=>{
    await tx.organization.update({where:{id},data:{name:parsed.data.organizationName}});
    await tx.user.update({where:{id:owner.id},data:{name:parsed.data.ownerName,email:parsed.data.ownerEmail}});
  });
  const compliance=await updateOrganizerCompliance({
    organizationId:id,businessType:parsed.data.businessType||null,country:parsed.data.country||null,phone:parsed.data.phone||null,
    bankAccountLabel:parsed.data.bankAccountLabel||null,taxDocumentLabel:parsed.data.taxDocumentLabel||null,
  });
  return NextResponse.json({ok:true,compliance});
}
