import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createCustomerMagicToken } from "@/lib/customer-auth";
import { claimNotification, completeNotification, failNotification } from "@/lib/notification-ledger";
import { localeConfig, normalizeLocale, type Locale } from "@/lib/i18n";

const schema = z.object({
  email: z.string().trim().email().max(250),
  locale: z.enum(["ru", "he", "en"]).optional(),
});
const LOGIN_RATE_LIMIT_MS = 2 * 60_000;

const copy: Record<Locale, { subject: string; title: string; text: string; button: string; ignore: string; error: string }> = {
  ru: { subject: "Вход в личный кабинет Atlas One", title: "Вход в личный кабинет", text: "Нажмите кнопку ниже, чтобы войти. Ссылка действует 15 минут.", button: "Открыть мои билеты", ignore: "Если вы не запрашивали вход, просто проигнорируйте это письмо.", error: "Не удалось отправить ссылку для входа" },
  he: { subject: "כניסה לאזור האישי ב-Atlas One", title: "כניסה לאזור האישי", text: "לחצו על הכפתור כדי להיכנס. הקישור תקף למשך 15 דקות.", button: "לצפייה בכרטיסים שלי", ignore: "לא ביקשתם להיכנס? אפשר פשוט להתעלם מהמייל הזה.", error: "לא ניתן לשלוח את קישור הכניסה" },
  en: { subject: "Sign in to your Atlas One account", title: "Sign in to your account", text: "Use the button below to sign in. The link is valid for 15 minutes.", button: "Open my tickets", ignore: "If you did not request this sign-in, you can ignore this email.", error: "Could not send the sign-in link" },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

export async function POST(request: Request) {
  let responseLocale: Locale = "ru";
  try {
    const { email, locale: requestedLocale } = schema.parse(await request.json());
    responseLocale = normalizeLocale(requestedLocale);
    const normalized = email.toLowerCase();
    const latestOrder = await db.order.findFirst({
      where: { customerEmail: normalized },
      orderBy: { createdAt: "desc" },
      select: { id: true, communicationLocale: true },
    });

    // Always return success to avoid exposing whether an email exists.
    if (!latestOrder) return NextResponse.json({ ok: true });

    const rateBucket = Math.floor(Date.now() / LOGIN_RATE_LIMIT_MS);
    const requestClaim = await claimNotification({
      dedupeKey: `customer-login-request:${normalized}:${rateBucket}`,
      channel: "EMAIL",
      type: "CUSTOMER_LOGIN_REQUEST",
      recipient: normalized,
      priceMinor: 0,
      metadata: { email: normalized },
    });
    if (!requestClaim.claimed) return NextResponse.json({ ok: true, throttled: true });

    const origin = new URL(request.url).origin;
    const token = createCustomerMagicToken(normalized);
    const emailUrl = `${origin}/api/account/verify?token=${encodeURIComponent(token)}`;
    const locale = normalizeLocale(requestedLocale ?? latestOrder.communicationLocale);
    responseLocale = locale;
    const text = copy[locale];
    const localeSettings = localeConfig[locale];
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("RESEND_NOT_CONFIGURED");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [normalized],
        subject: text.subject,
        html: `<div lang="${localeSettings.tag}" dir="${localeSettings.dir}" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px;color:#ff5947">ATLAS ONE</div><h1 style="margin:10px 0 0">${text.title}</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>${text.text}</p><p style="text-align:center;margin:24px 0"><a href="${escapeHtml(emailUrl)}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:13px 20px;border-radius:10px">${text.button}</a></p><p style="font-size:12px;color:#6b7280">${text.ignore}</p></div></div>`,
      }),
    });
    if (!response.ok) {
      await failNotification(requestClaim.id!, text.error);
      throw new Error("EMAIL_DELIVERY_FAILED");
    }
    await completeNotification(requestClaim.id!, { providerStatus: response.status, providerMessage: "Resend accepted" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[customer-login]", error);
    return NextResponse.json({ error: copy[responseLocale].error }, { status: 400 });
  }
}
