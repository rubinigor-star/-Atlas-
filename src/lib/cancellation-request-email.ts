import { db } from "@/lib/db";

function baseUrl() {
  return (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}
function resendFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && !configured.startsWith("re_") && configured.includes("@")
    ? configured
    : "Atlas One <tickets@mail.atlas-one.co>";
}
async function sendEmail(input: { requestId: string; recipient: string; subject: string; html: string; type: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");
  const recipient = process.env.RESEND_TEST_TO || input.recipient;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: resendFromAddress(), to: [recipient], subject: input.subject, html: input.html }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`;
    console.error("cancellation.email.failed", { requestId: input.requestId, type: input.type, recipient, status: response.status, message });
    throw new Error(message);
  }
  console.info("cancellation.email.sent", { requestId: input.requestId, type: input.type, recipient, emailId: payload?.id || null });
  return { id: payload?.id as string | undefined, recipient };
}

async function loadRequest(requestId: string) {
  const rows = await db.$queryRawUnsafe<Array<{
    publicId: string;
    customerEmail: string;
    reason: string | null;
    decisionNote: string | null;
    legalStatus: string;
    orderAmountMinor: number;
    statutoryFeeMinor: number;
    refundAmountMinor: number | null;
    orderPublicId: string;
    customerName: string;
    eventTitle: string;
  }>>(
    `SELECT c."publicId",c."customerEmail",c."reason",c."decisionNote",c."legalStatus",c."orderAmountMinor",c."statutoryFeeMinor",c."refundAmountMinor",o."publicId" AS "orderPublicId",o."customerName",e."title" AS "eventTitle"
     FROM "CancellationRequest" c JOIN "Order" o ON o."id"=c."orderId" JOIN "Event" e ON e."id"=c."eventId"
     WHERE c."id"=$1 LIMIT 1`,
    requestId,
  );
  const row = rows[0];
  if (!row) throw new Error("Заявка на отмену не найдена");
  return row;
}

function shell(title: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px"><h1 style="margin:0;font-size:26px">${escapeHtml(title)}</h1></div><div style="padding:26px">${body}</div><div style="padding:0 26px 26px;color:#9ca3af;font-size:12px">Atlas One</div></div>`;
}

export async function sendCancellationSubmittedEmail(requestId: string) {
  const row = await loadRequest(requestId);
  const policyUrl = `${baseUrl()}/cancellation-policy?order=${encodeURIComponent(row.orderPublicId)}&email=${encodeURIComponent(row.customerEmail)}`;
  const standardRefund = Math.max(0, row.orderAmountMinor - row.statutoryFeeMinor);
  return sendEmail({
    requestId: row.publicId,
    recipient: row.customerEmail,
    subject: `Заявка на отмену ${row.publicId} принята`,
    type: "submitted",
    html: shell("Заявка на отмену принята", `<p>Здравствуйте, ${escapeHtml(row.customerName)}.</p><p>Мы получили вашу заявку <strong>${escapeHtml(row.publicId)}</strong> по заказу <strong>${escapeHtml(row.orderPublicId)}</strong> на мероприятие <strong>${escapeHtml(row.eventTitle)}</strong>.</p><p>Заявка передана организатору. Atlas сохранит её номер и сообщит вам о решении по email.</p><p>Ориентир стандартного возврата на данный момент: <strong>${(standardRefund / 100).toFixed(2)} ₪</strong>. Финальная сумма зависит от решения организатора и применимых условий отмены.</p><p><a href="${policyUrl}">Открыть правила отмены</a></p>`),
  });
}

export async function sendCancellationRejectedEmail(requestId: string) {
  const row = await loadRequest(requestId);
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(row.orderPublicId)}`;
  const note = row.decisionNote?.trim() || "Организатор не подтвердил возврат по этой заявке.";
  return sendEmail({
    requestId: row.publicId,
    recipient: row.customerEmail,
    subject: `Решение по заявке ${row.publicId}`,
    type: "rejected",
    html: shell("Заявка на отмену не одобрена", `<p>Здравствуйте, ${escapeHtml(row.customerName)}.</p><p>Организатор рассмотрел заявку <strong>${escapeHtml(row.publicId)}</strong> по заказу <strong>${escapeHtml(row.orderPublicId)}</strong>.</p><p><strong>Решение:</strong> возврат не одобрен.</p><p>${escapeHtml(note)}</p><p>Ваши билеты остаются действительными.</p><p><a href="${orderUrl}">Открыть заказ</a></p>`),
  });
}
