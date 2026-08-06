import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createCustomerMagicToken } from "@/lib/customer-auth";
import { claimNotification, completeNotification, failNotification } from "@/lib/notification-ledger";

const schema = z.object({ email: z.string().trim().email().max(250) });
const LOGIN_RATE_LIMIT_MS = 2 * 60_000;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const normalized = email.toLowerCase();
    const latestOrder = await db.order.findFirst({
      where: { customerEmail: normalized },
      orderBy: { createdAt: "desc" },
      select: { id: true },
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
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("Resend не настроен в Vercel");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [normalized],
        subject: "Вход в личный кабинет Atlas One",
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px;color:#ff5947">ATLAS ONE</div><h1 style="margin:10px 0 0">Вход в личный кабинет</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>Для входа нажмите кнопку ниже. Ссылка действует 15 минут.</p><p style="text-align:center;margin:24px 0"><a href="${escapeHtml(emailUrl)}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:13px 20px;border-radius:10px">Открыть мои билеты</a></p><p style="font-size:12px;color:#6b7280">Если вы не запрашивали вход, просто проигнорируйте это письмо.</p></div></div>`,
      }),
    });
    if (!response.ok) {
      await failNotification(requestClaim.id!, "Не удалось отправить ссылку для входа");
      throw new Error("Не удалось отправить ссылку для входа");
    }
    await completeNotification(requestClaim.id!, { providerStatus: response.status, providerMessage: "Resend accepted" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось отправить ссылку" }, { status: 400 });
  }
}
