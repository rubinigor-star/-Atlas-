import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";
import { createHypApprovalPaymentPage } from "@/lib/hyp-creditguard";

const APP_URL="https://www.atlas-one.co";
function launch(value:string){return `/payments/hyp/launch?target=${encodeURIComponent(value)}`;}

export async function POST(req:Request,{params}:{params:Promise<{orderId:string}>}){
  try{
    const {orderId}=await params;
    const body=await req.json().catch(()=>({}));
    const code=String(body?.code||"").trim().toUpperCase();
    const locale=body?.locale==="he"?"he":body?.locale==="en"?"en":"ru";
    const order=await db.order.findFirst({where:{OR:[{publicId:orderId},{id:orderId}]},include:{items:true,event:true}});
    if(!order||order.status!=="PENDING")return NextResponse.json({error:"Заказ недоступен для изменения"},{status:400});
    let discountPercent=0;
    if(code){
      const promo=await db.promoCode.findUnique({where:{eventId_code:{eventId:order.eventId,code}}});
      if(!promo?.active)return NextResponse.json({error:locale==="he"?"קוד הקופון אינו תקין או אינו פעיל":locale==="en"?"Voucher code is invalid or inactive":"Ваучерный код недействителен или неактивен"},{status:400});
      discountPercent=promo.discountPercent;
    }
    const baseSubtotal=order.items.reduce((sum,item)=>sum+item.unitPriceMinor*item.quantity,0);
    const discountedSubtotal=Math.round(baseSubtotal*(100-discountPercent)/100);
    const terms=await getEffectiveEventTerms(order.eventId,order.event.organizationId);
    const pricing=calculateServiceFee(discountedSubtotal,{salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer});
    await db.$transaction(async tx=>{
      await tx.order.update({where:{id:order.id},data:{totalMinor:pricing.buyerTotalMinor}});
      await tx.$executeRawUnsafe(`UPDATE "OrderCommercialSnapshot" SET "subtotalMinor"=$2,"serviceFeeMinor"=$3,"buyerTotalMinor"=$4,"organizerNetMinor"=$5 WHERE "orderId"=$1`,order.id,pricing.subtotalMinor,pricing.serviceFeeMinor,pricing.buyerTotalMinor,pricing.organizerNetMinor).catch(()=>undefined);
    });
    const language=locale==="he"?"HEB" as const:"ENG" as const;
    const paymentUrl=order.event.salesMode==="APPROVAL_REQUIRED"
      ?await createHypApprovalPaymentPage({amountMinor:pricing.buyerTotalMinor,orderId:order.publicId,callbackPath:"/api/payments/hyp/approval",language,customerName:order.customerName,customerEmail:order.customerEmail,customerPhone:order.customerPhone})
      :await createHypPaymentLink({amountIls:pricing.buyerTotalMinor/100,orderId:order.publicId,description:order.event.title,customerName:order.customerName,customerEmail:order.customerEmail,customerPhone:order.customerPhone,returnUrl:`${APP_URL}/api/payments/hyp/order`,language});
    return NextResponse.json({valid:true,discountPercent,subtotalMinor:pricing.subtotalMinor,serviceFeeMinor:pricing.serviceFeeMinor,totalMinor:pricing.buyerTotalMinor,paymentUrl:launch(paymentUrl)});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Не удалось применить ваучер"},{status:400});}
}
