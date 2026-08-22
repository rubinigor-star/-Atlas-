import { db } from "@/lib/db";
import { localeConfig, normalizeLocale, type Locale } from "@/lib/i18n";
import { money } from "@/lib/format";

export const cancellationRequestCopy={
  ru:{submittedSubject:"Заявка на отмену принята",submittedTitle:"Заявка на отмену принята",hello:"Здравствуйте",received:"Мы получили вашу заявку",order:"по заказу",event:"на мероприятие",sent:"Заявка передана организатору. Atlas сохранит её номер и сообщит вам о решении по email.",estimate:"Ориентир стандартного возврата на данный момент",estimateTail:"Финальная сумма зависит от решения организатора и применимых условий отмены.",policy:"Открыть правила отмены",decisionSubject:"Решение по заявке",rejectedTitle:"Заявка на отмену не одобрена",reviewed:"Организатор рассмотрел заявку",decision:"Решение",notApproved:"возврат не одобрен",fallback:"Организатор не подтвердил возврат по этой заявке.",valid:"Ваши билеты остаются действительными.",open:"Открыть заказ"},
  he:{submittedSubject:"בקשת הביטול התקבלה",submittedTitle:"בקשת הביטול התקבלה",hello:"שלום",received:"קיבלנו את בקשת הביטול",order:"עבור הזמנה",event:"לאירוע",sent:"הבקשה הועברה למפיק. Atlas תשמור את מספר הבקשה ותשלח אליך את ההחלטה במייל.",estimate:"סכום ההחזר המשוער לפי התנאים הרגילים כרגע",estimateTail:"הסכום הסופי תלוי בהחלטת המפיק ובתנאי הביטול הרלוונטיים.",policy:"לצפייה במדיניות הביטול",decisionSubject:"החלטה לגבי בקשת הביטול",rejectedTitle:"בקשת הביטול לא אושרה",reviewed:"המפיק בדק את הבקשה",decision:"החלטה",notApproved:"ההחזר לא אושר",fallback:"המפיק לא אישר החזר עבור בקשה זו.",valid:"הכרטיסים שלך עדיין בתוקף.",open:"לצפייה בהזמנה"},
  en:{submittedSubject:"Cancellation request received",submittedTitle:"Cancellation request received",hello:"Hello",received:"We received your cancellation request",order:"for order",event:"for",sent:"The request was sent to the organizer. Atlas will keep its reference number and email you when a decision is made.",estimate:"Current standard refund estimate",estimateTail:"The final amount depends on the organizer's decision and the applicable cancellation terms.",policy:"View cancellation policy",decisionSubject:"Cancellation request decision",rejectedTitle:"Cancellation request not approved",reviewed:"The organizer reviewed request",decision:"Decision",notApproved:"the refund was not approved",fallback:"The organizer did not approve a refund for this request.",valid:"Your tickets remain valid.",open:"Open order"},
} as const;

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
    communicationLocale: string;
  }>>(
    `SELECT c."publicId",c."customerEmail",c."reason",c."decisionNote",c."legalStatus",c."orderAmountMinor",c."statutoryFeeMinor",c."refundAmountMinor",o."publicId" AS "orderPublicId",o."customerName",o."communicationLocale",e."title" AS "eventTitle"
     FROM "CancellationRequest" c JOIN "Order" o ON o."id"=c."orderId" JOIN "Event" e ON e."id"=c."eventId"
     WHERE c."id"=$1 LIMIT 1`,
    requestId,
  );
  const row = rows[0];
  if (!row) throw new Error("Заявка на отмену не найдена");
  return row;
}

function shell(locale:Locale,title: string, body: string) {
  return `<div lang="${localeConfig[locale].tag}" dir="${localeConfig[locale].dir}" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px"><h1 style="margin:0;font-size:26px">${escapeHtml(title)}</h1></div><div style="padding:26px">${body}</div><div style="padding:0 26px 26px;color:#9ca3af;font-size:12px">Atlas One</div></div>`;
}

export async function sendCancellationSubmittedEmail(requestId: string) {
  const row = await loadRequest(requestId);
  const locale=normalizeLocale(row.communicationLocale);const c=cancellationRequestCopy[locale];
  const policyUrl = `${baseUrl()}/cancellation-policy?order=${encodeURIComponent(row.orderPublicId)}&email=${encodeURIComponent(row.customerEmail)}`;
  const standardRefund = Math.max(0, row.orderAmountMinor - row.statutoryFeeMinor);
  return sendEmail({
    requestId: row.publicId,
    recipient: row.customerEmail,
    subject: `${c.submittedSubject} - ${row.publicId}`,
    type: "submitted",
    html: shell(locale,c.submittedTitle, `<p>${c.hello}, ${escapeHtml(row.customerName)}.</p><p>${c.received} <strong dir="ltr">${escapeHtml(row.publicId)}</strong> ${c.order} <strong dir="ltr">${escapeHtml(row.orderPublicId)}</strong> ${c.event} <strong>${escapeHtml(row.eventTitle)}</strong>.</p><p>${c.sent}</p><p>${c.estimate}: <strong>${money(standardRefund,"ILS",locale)}</strong>. ${c.estimateTail}</p><p><a href="${policyUrl}">${c.policy}</a></p>`),
  });
}

export async function sendCancellationRejectedEmail(requestId: string) {
  const row = await loadRequest(requestId);
  const locale=normalizeLocale(row.communicationLocale);const c=cancellationRequestCopy[locale];
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(row.orderPublicId)}`;
  const rawNote=row.decisionNote?.trim()||"";const note=locale==="ru"?rawNote||c.fallback:locale==="he"&&/[\u0590-\u05ff]/.test(rawNote)?rawNote:locale==="en"&&!/[\u0400-\u04ff\u0590-\u05ff]/.test(rawNote)?rawNote:c.fallback;
  return sendEmail({
    requestId: row.publicId,
    recipient: row.customerEmail,
    subject: `${c.decisionSubject} - ${row.publicId}`,
    type: "rejected",
    html: shell(locale,c.rejectedTitle, `<p>${c.hello}, ${escapeHtml(row.customerName)}.</p><p>${c.reviewed} <strong dir="ltr">${escapeHtml(row.publicId)}</strong> ${c.order} <strong dir="ltr">${escapeHtml(row.orderPublicId)}</strong>.</p><p><strong>${c.decision}:</strong> ${c.notApproved}.</p><p>${escapeHtml(note)}</p><p>${c.valid}</p><p><a href="${orderUrl}">${c.open}</a></p>`),
  });
}
