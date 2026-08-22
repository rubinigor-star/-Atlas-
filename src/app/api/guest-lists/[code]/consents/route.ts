import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkoutConsentTexts, ensureCheckoutConsentRuntime, saveCheckoutConsents } from "@/lib/checkout-consent";
import { isGuestListPromoter } from "@/lib/guest-links";
import { enrollApprovedOrderInValueCard } from "@/lib/valuecard";
import { normalizeLocale, type Locale } from "@/lib/i18n";

const schema = z.object({
  publicId: z.string().min(1),
  email: z.string().email(),
  phone: z.string().max(30).optional().default(""),
  locale: z.enum(["ru", "he", "en"]),
  consents: z.object({
    atlasMarketing: z.literal(true),
    organizerMarketingAndClub: z.literal(true),
  }),
});
const copy={
  ru:{link:"Гостевая ссылка не найдена",order:"Заказ гостевой ссылки не найден",failed:"Не удалось сохранить согласия"},
  he:{link:"קישור האורחים לא נמצא",order:"הזמנת האורח לא נמצאה",failed:"לא הצלחנו לשמור את ההסכמות"},
  en:{link:"Guest link not found",order:"Guest-link order not found",failed:"Could not save consents"},
} as const;

function requestIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}
function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  let locale:Locale="ru";
  try {
    await ensureCheckoutConsentRuntime();
    const { code } = await params;
    const raw=await req.json();
    locale=normalizeLocale(raw?.locale);
    const input = schema.parse(raw);
    const link = await db.promoterLink.findUnique({
      where: { code: code.toUpperCase() },
      include: { promoter: true },
    });
    if (!link || !isGuestListPromoter(link.promoter.name)) return NextResponse.json({ error: copy[locale].link }, { status: 404 });

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(input.phone);
    const order = await db.order.findFirst({
      where: { publicId: input.publicId, promoterLinkId: link.id, customerEmail: normalizedEmail, ...(normalizedPhone ? { customerPhone: normalizedPhone } : {}) },
      select: { id: true, publicId: true, status: true, guestId: true, event: { select: { organizationId: true } } },
    });
    if (!order || !order.guestId) return NextResponse.json({ error: copy[locale].order }, { status: 404 });

    const texts = checkoutConsentTexts(input.locale);
    await saveCheckoutConsents({
      executor: db,
      orderId: order.id,
      organizationId: order.event.organizationId,
      guestId: order.guestId,
      consents: input.consents,
      proof: { locale: input.locale, ipAddress: requestIp(req), userAgent: req.headers.get("user-agent"), atlasText: texts.atlas, organizerText: texts.organizer },
    });

    if (order.status === "PAID") {
      try { await enrollApprovedOrderInValueCard(order.publicId); }
      catch (error) { console.error("valuecard.guest_link.enrollment_failed", { publicId: order.publicId, message: error instanceof Error ? error.message : "UNKNOWN_VALUECARD_ERROR" }); }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[guest-list-consents]",error);
    return NextResponse.json({ error: copy[locale].failed }, { status: 400 });
  }
}
