import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";

export async function POST(req:Request){
  try{
    const body=await req.json() as {eventId?:string;code?:string;subtotalMinor?:number};
    const eventId=String(body.eventId||"");
    const code=String(body.code||"").trim().toUpperCase();
    const base=Math.max(0,Math.round(Number(body.subtotalMinor)||0));
    if(!eventId||!code)return NextResponse.json({valid:false,discountPercent:0,subtotalMinor:base,serviceFeeMinor:0,totalMinor:base});
    const event=await db.event.findUnique({where:{id:eventId},select:{id:true,organizationId:true}});
    if(!event)return NextResponse.json({valid:false,discountPercent:0,subtotalMinor:base,serviceFeeMinor:0,totalMinor:base},{status:404});
    const promo=await db.promoCode.findUnique({where:{eventId_code:{eventId,code}}});
    const discountPercent=promo?.active?Math.max(0,Math.min(100,promo.discountPercent)):0;
    const subtotalMinor=Math.round(base*(100-discountPercent)/100);
    const terms=await getEffectiveEventTerms(event.id,event.organizationId);
    const pricing=calculateServiceFee(subtotalMinor,{salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer});
    return NextResponse.json({valid:Boolean(promo?.active),discountPercent,subtotalMinor:pricing.subtotalMinor,serviceFeeMinor:pricing.serviceFeeMinor,totalMinor:pricing.buyerTotalMinor});
  }catch{
    return NextResponse.json({error:"Invalid coupon preview request"},{status:400});
  }
}
