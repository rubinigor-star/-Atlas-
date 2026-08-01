import { NextResponse } from "next/server";
import { z } from "zod";
import { optOutAbandonedCheckout } from "@/lib/abandoned-checkout";

const schema = z.string().uuid();

function logo() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="font-family:Arial,sans-serif;font-size:42px;line-height:42px;font-weight:900;letter-spacing:-2px;color:#ff7600">ATLAS</td><td style="padding-left:4px"><span style="display:inline-block;background:#08254a;color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;line-height:12px;padding:4px 3px;border-radius:2px;writing-mode:vertical-rl;transform:rotate(180deg)">one</span></td></tr></table>`;
}

export async function GET(request: Request) {
  const token = schema.safeParse(new URL(request.url).searchParams.get("token"));
  if (!token.success) return new NextResponse("Некорректная ссылка", { status: 400 });
  await optOutAbandonedCheckout(token.data);
  const home = new URL("/", request.url).toString();
  return new NextResponse(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Напоминания остановлены</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#f4f6f8;padding:40px 18px;color:#111827"><main style="max-width:620px;margin:auto;background:white;padding:34px;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 12px 36px rgba(8,20,38,.08)">${logo()}<div style="width:52px;height:52px;border-radius:50%;background:#dcfae6;color:#067647;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;margin-top:28px">✓</div><h1 style="font-size:30px;margin:18px 0 12px">Напоминания остановлены</h1><p style="font-size:17px;line-height:1.55">Мы больше не будем отправлять сообщения по этой незавершённой покупке.</p><p style="color:#667085;line-height:1.55">Это не отключает билеты, сообщения о возврате, переносе или другие важные сервисные уведомления.</p><a href="${home}" style="display:inline-block;margin-top:18px;background:#ff7600;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Вернуться на Atlas</a></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
