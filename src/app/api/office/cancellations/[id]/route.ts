import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { reviewCancellationRequest } from "@/lib/cancellations";

const schema=z.object({action:z.enum(["APPROVE","REJECT"]),refundAmountMinor:z.number().int().min(0).optional(),note:z.string().max(1000).optional()});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const staff=await requirePermission("ORDER_MANAGE");
  const {id}=await params;
  const input=schema.parse(await request.json());
  const allowedEventIds=staff.eventAccess.map(item=>item.eventId);
  try{
    const result=await reviewCancellationRequest({id,organizationId:staff.organizationId!,actorId:staff.id,allowedEventIds:allowedEventIds.length?allowedEventIds:undefined,...input});
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const code=error instanceof Error?error.message:"REVIEW_FAILED";
    return NextResponse.json({error:code},{status:code==="REQUEST_NOT_FOUND"?404:code==="REQUEST_ALREADY_REVIEWED"?409:400});
  }
}
