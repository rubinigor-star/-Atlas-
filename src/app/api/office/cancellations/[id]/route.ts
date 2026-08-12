import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getCancellationRequest, reviewCancellationRequest } from "@/lib/cancellations";
import { db } from "@/lib/db";
import { OrderRefundError, refundOrder } from "@/lib/order-refund-service";
import { sendCancellationRejectedEmail } from "@/lib/cancellation-request-email";

const schema=z.object({action:z.enum(["APPROVE","REJECT"]),refundAmountMinor:z.number().int().min(1).optional(),note:z.string().max(1000).optional()});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const staff=await requirePermission("ORDER_MANAGE");
  const {id}=await params;
  const input=schema.parse(await request.json());
  const allowedEventIds=staff.eventAccess.map(item=>item.eventId);
  const access=allowedEventIds.length?allowedEventIds:undefined;
  try{
    if(input.action==="REJECT"){
      const result=await reviewCancellationRequest({id,organizationId:staff.organizationId!,actorId:staff.id,allowedEventIds:access,action:"REJECT",note:input.note});
      let emailSent=false;
      let emailError:string|null=null;
      try{
        await sendCancellationRejectedEmail(id);
        emailSent=true;
      }catch(error){
        emailError=error instanceof Error?error.message:"Не удалось отправить email об отказе";
        console.error("cancellation.rejected_email.failed",{requestId:id,message:emailError});
      }
      return NextResponse.json({ok:true,...result,emailSent,emailError});
    }

    const cancellation=await getCancellationRequest(id,staff.organizationId!,access);
    if(!cancellation)return NextResponse.json({error:"REQUEST_NOT_FOUND"},{status:404});
    if(cancellation.status!=="NEW")return NextResponse.json({error:"REQUEST_ALREADY_REVIEWED"},{status:409});

    const refundAmountMinor=Math.max(1,Math.min(cancellation.orderAmountMinor,Math.round(input.refundAmountMinor??(cancellation.orderAmountMinor-cancellation.statutoryFeeMinor))));
    const standardRefundMinor=cancellation.orderAmountMinor-cancellation.statutoryFeeMinor;
    const organizerChargeMinor=Math.max(0,refundAmountMinor-standardRefundMinor);
    const decisionNote=input.note?.trim()||null;

    await db.$executeRawUnsafe(
      `UPDATE "CancellationRequest" SET "status"='REFUND_PENDING',"refundAmountMinor"=$2,"organizerChargeMinor"=$3,"decisionNote"=$4,"reviewedBy"=$5,"reviewedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='NEW'`,
      id,refundAmountMinor,organizerChargeMinor,decisionNote,staff.id,
    );

    try{
      const refund=await refundOrder(cancellation.orderPublicId,{
        amountMinor:refundAmountMinor,
        reason:decisionNote||`Cancellation request ${cancellation.publicId}`,
        idempotencyKey:`cancellation:${cancellation.id}`,
        cancelOrderAfterRefund:true,
        cancellationPublicId:cancellation.publicId,
      });
      await db.$executeRawUnsafe(`UPDATE "CancellationRequest" SET "status"='REFUNDED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,id);
      return NextResponse.json({ok:true,status:"REFUNDED",refundAmountMinor,organizerChargeMinor,refund});
    }catch(error){
      const message=error instanceof Error?error.message:"HYP_REFUND_FAILED";
      await db.$executeRawUnsafe(`UPDATE "CancellationRequest" SET "status"='REFUND_FAILED',"decisionNote"=COALESCE("decisionNote",'') || $2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,id,`\nHYP: ${message}`);
      throw error;
    }
  }catch(error){
    const code=error instanceof Error?error.message:"REVIEW_FAILED";
    const status=error instanceof OrderRefundError?error.status:code==="REQUEST_NOT_FOUND"?404:code==="REQUEST_ALREADY_REVIEWED"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
