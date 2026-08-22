import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { sendOrderTicketSms } from "@/lib/order-sms";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";

const copy={ru:{missing:"Заказ не найден",forbidden:"Недостаточно прав",failed:"Не удалось отправить билеты"},he:{missing:"ההזמנה לא נמצאה",forbidden:"אין הרשאה מתאימה",failed:"לא ניתן לשלוח את הכרטיסים"},en:{missing:"Order not found",forbidden:"Insufficient permission",failed:"Could not send tickets"}} as const;
function localeFor(actor:Awaited<ReturnType<typeof requireEventAccess>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}

export async function POST(request: Request,{ params }: { params: Promise<{ publicId: string }> }) {
  const {publicId}=await params;
  let locale:Locale="ru";
  try {
    const order=await db.order.findUnique({where:{publicId},select:{eventId:true}});
    if(!order)return NextResponse.json({error:copy[locale].missing},{status:404});
    const actor=await requireEventAccess("ORDER_MANAGE",order.eventId);locale=localeFor(actor);
    const body = await request.json().catch(() => ({}));
    const channel = body?.channel === "sms" ? "sms" : "email";
    if (channel === "sms") {
      const result = await sendOrderTicketSms(publicId);
      return NextResponse.json({sent:true,channel,recipient:result.recipient,priceMinor:result.priceMinor,providerStatus:result.providerStatus});
    }
    const result = await sendOrderTicketEmail(publicId);
    return NextResponse.json({ sent: true, channel, recipient: result.recipient, id: result.id, priceMinor: 0 });
  } catch (error) {
    console.error("admin.order.resend_failed",{publicId,message:error instanceof Error?error.message:"UNKNOWN_RESEND_ERROR"});
    const forbidden=error instanceof Error&&error.message==="FORBIDDEN";
    return NextResponse.json({ error: forbidden?copy[locale].forbidden:copy[locale].failed },{ status: forbidden?403:400 });
  }
}
