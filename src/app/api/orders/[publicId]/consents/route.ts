import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkoutConsentTexts, ensureCheckoutConsentRuntime, saveCheckoutConsents } from "@/lib/checkout-consent";

const schema=z.object({
  idempotencyKey:z.string().uuid(),
  locale:z.enum(["ru","he","en"]),
  consents:z.object({
    atlasMarketing:z.literal(true),
    organizerMarketingAndClub:z.literal(true),
  }),
});

function requestIp(req:Request){return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||req.headers.get("x-real-ip")||null;}

export async function POST(req:Request,{params}:{params:Promise<{publicId:string}>}){
  try{
    await ensureCheckoutConsentRuntime();
    const {publicId}=await params;
    const input=schema.parse(await req.json());
    const order=await db.order.findFirst({
      where:{publicId,idempotencyKey:input.idempotencyKey},
      select:{id:true,guestId:true,event:{select:{organizationId:true}}},
    });
    if(!order||!order.guestId)return NextResponse.json({error:"Заказ не найден"},{status:404});
    const texts=checkoutConsentTexts(input.locale);
    await saveCheckoutConsents({
      executor:db,
      orderId:order.id,
      organizationId:order.event.organizationId,
      guestId:order.guestId,
      consents:input.consents,
      proof:{
        locale:input.locale,
        ipAddress:requestIp(req),
        userAgent:req.headers.get("user-agent"),
        atlasText:texts.atlas,
        organizerText:texts.organizer,
      },
    });
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Не удалось сохранить согласие"},{status:400});
  }
}
