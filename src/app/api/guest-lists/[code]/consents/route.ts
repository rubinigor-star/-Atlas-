import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkoutConsentTexts, ensureCheckoutConsentRuntime, saveCheckoutConsents } from "@/lib/checkout-consent";
import { isGuestListPromoter } from "@/lib/guest-links";
import { enrollApprovedOrderInValueCard } from "@/lib/valuecard";

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
  try {
    await ensureCheckoutConsentRuntime();
    const { code } = await params;
    const input = schema.parse(await req.json());
    const link = await db.promoterLink.findUnique({
      where: { code: code.toUpperCase() },
      include: { promoter: true },
    });
    if (!link || !isGuestListPromoter(link.promoter.name)) {
      return NextResponse.json({ error: "Гостевая ссылка не найдена" }, { status: 404 });
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(input.phone);
    const order = await db.order.findFirst({
      where: {
        publicId: input.publicId,
        promoterLinkId: link.id,
        customerEmail: normalizedEmail,
        ...(normalizedPhone ? { customerPhone: normalizedPhone } : {}),
      },
      select: {
        id: true,
        publicId: true,
        status: true,
        guestId: true,
        event: { select: { organizationId: true } },
      },
    });
    if (!order || !order.guestId) {
      return NextResponse.json({ error: "Заказ гостевой ссылки не найден" }, { status: 404 });
    }

    const texts = checkoutConsentTexts(input.locale);
    await saveCheckoutConsents({
      executor: db,
      orderId: order.id,
      organizationId: order.event.organizationId,
      guestId: order.guestId,
      consents: input.consents,
      proof: {
        locale: input.locale,
        ipAddress: requestIp(req),
        userAgent: req.headers.get("user-agent"),
        atlasText: texts.atlas,
        organizerText: texts.organizer,
      },
    });

    if (order.status === "PAID") {
      try {
        await enrollApprovedOrderInValueCard(order.publicId);
      } catch (error) {
        console.error("valuecard.guest_link.enrollment_failed", {
          publicId: order.publicId,
          message: error instanceof Error ? error.message : "Unknown ValueCard error",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить согласие" }, { status: 400 });
  }
}
