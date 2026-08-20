import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getCancellationRequest, reviewCancellationRequest } from "@/lib/cancellations";
import { OrderRefundError, refundOrder } from "@/lib/order-refund-service";
import { sendCancellationRejectedEmail } from "@/lib/cancellation-request-email";

const schema=z.object({action:z.enum(["APPROVE","REJECT"]),refundAmountMinor:z.number().int().min(1).optional(),cancellationFeePayer:z.enum(["CUSTOMER","ORGANIZER"]).optional(),note:z.string().max(1000).optional()});

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

    const standardRefundMinor=cancellation.orderAmountMinor-cancellation.statutoryFeeMinor;
    const requestedRefundMinor=Math.max(1,Math.min(cancellation.orderAmountMinor,Math.round(input.refundAmountMinor??standardRefundMinor)));
    const cancellationFeePayer=input.cancellationFeePayer??(requestedRefundMinor>standardRefundMinor?"ORGANIZER":"CUSTOMER");
    const decisionNote=input.note?.trim()||`Cancellation request ${cancellation.publicId}`;

    const refund=await refundOrder(cancellation.orderPublicId,{
      mode:"CANCELLATION",
      reason:decisionNote,
      idempotencyKey:`cancellation:${cancellation.id}`,
      cancellationPublicId:cancellation.publicId,
      cancellationFeePayer,
    },{actorId:staff.id});

    return NextResponse.json({ok:true,status:"REFUNDED",refundAmountMinor:refund.amountMinor,organizerChargeMinor:refund.organizerChargeMinor,cancellationFeePayer,refund});
  }catch(error){
    const code=error instanceof Error?error.message:"REVIEW_FAILED";
    const status=error instanceof OrderRefundError?error.status:code==="REQUEST_NOT_FOUND"?404:code==="REQUEST_ALREADY_REVIEWED"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
