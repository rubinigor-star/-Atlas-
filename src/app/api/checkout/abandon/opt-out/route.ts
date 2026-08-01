import { NextResponse } from "next/server";
import { z } from "zod";
import { optOutAbandonedCheckout } from "@/lib/abandoned-checkout";

const schema = z.string().uuid();

export async function GET(request: Request) {
  const token = schema.safeParse(new URL(request.url).searchParams.get("token"));
  if (!token.success) return new NextResponse("Некорректная ссылка", { status: 400 });
  await optOutAbandonedCheckout(token.data);
  return new NextResponse(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Напоминания остановлены</title><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:40px;color:#111827"><main style="max-width:620px;margin:auto;background:white;padding:32px;border-radius:18px;border:1px solid #e5e7eb"><div style="font-size:13px;letter-spacing:2px;color:#ff7a18">ATLAS ONE</div><h1>Напоминания остановлены</h1><p>Мы больше не будем отправлять сообщения по этой незавершённой покупке.</p><p style="color:#6b7280">Это не отключает билеты, сообщения о возврате, переносе или другие важные сервисные уведомления.</p></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
