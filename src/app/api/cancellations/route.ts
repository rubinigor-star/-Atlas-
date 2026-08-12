import { NextResponse } from "next/server";
import { z } from "zod";
import { createCancellationRequest, evaluateCancellationEligibility, findCancellationOrder, statutoryCancellationFeeMinor } from "@/lib/cancellations";
import { sendCancellationSubmittedEmail } from "@/lib/cancellation-request-email";

const lookupSchema = z.object({ orderId:z.string().min(3), email:z.string().email() });
const createSchema = lookupSchema.extend({ reason:z.string().max(1000).optional(), specialCategory:z.enum(["SENIOR","NEW_IMMIGRANT","DISABILITY"]).nullable().optional(), acceptedPolicy:z.literal(true) });

function safeOrder(order: NonNullable<Awaited<ReturnType<typeof findCancellationOrder>>>, specialCategory?: string | null) {
  const eligibility = evaluateCancellationEligibility(order.createdAt, order.eventStartsAt, specialCategory);
  const feeMinor = statutoryCancellationFeeMinor(order.totalMinor);
  return {
    publicId:order.publicId,
    customerName:order.customerName,
    totalMinor:order.totalMinor,
    currency:order.currency,
    status:order.status,
    createdAt:order.createdAt,
    eventTitle:order.eventTitle,
    eventStartsAt:order.eventStartsAt,
    ticketCount:order.ticketCount,
    itemSummary:order.itemSummary,
    eligibility,
    feeMinor,
    standardRefundMinor:Math.max(0,order.totalMinor-feeMinor),
    canRequest:order.status==="PAID" && new Date(order.eventStartsAt)>new Date(),
  };
}

export async function POST(request:Request){
  const input=lookupSchema.parse(await request.json());
  const order=await findCancellationOrder(input.orderId,input.email);
  if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});
  return NextResponse.json({order:safeOrder(order)});
}

export async function PUT(request:Request){
  const input=createSchema.parse(await request.json());
  const order=await findCancellationOrder(input.orderId,input.email);
  if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});
  try{
    const created=await createCancellationRequest({order,reason:input.reason,specialCategory:input.specialCategory});
    let emailSent=false;
    let emailError:string|null=null;
    try{
      await sendCancellationSubmittedEmail(created.id);
      emailSent=true;
    }catch(error){
      emailError=error instanceof Error?error.message:"Не удалось отправить подтверждение заявки";
      console.error("cancellation.submitted_email.failed",{requestId:created.publicId,message:emailError});
    }
    return NextResponse.json({ok:true,requestId:created.publicId,eligibility:created.eligibility,feeMinor:created.feeMinor,emailSent,emailError});
  }catch(error){
    const code=error instanceof Error?error.message:"REQUEST_FAILED";
    const status=code==="OPEN_REQUEST_EXISTS"?409:code==="ORDER_NOT_CANCELLABLE"||code==="EVENT_ALREADY_STARTED"?400:500;
    return NextResponse.json({error:code},{status});
  }
}
