import type { Locale } from "@/lib/i18n";
import { getSms019ConfigurationStatus, sendSms019 } from "@/lib/sms-019";

type RecoveryMessage = {
  recipient: string;
  firstName?: string | null;
  eventTitle: string;
  checkoutUrl: string;
  optOutUrl: string;
  amountMinor: number;
  templateKey: string;
  communicationLocale: Locale;
};

type DeliveryResult = { id?: string };
type ChannelAdapter = { configured(): boolean; send(message: RecoveryMessage): Promise<DeliveryResult> };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

function fromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && configured.includes("@") && !configured.startsWith("re_") ? configured : "Atlas One <tickets@mail.atlas-one.co>";
}

function atlasLogo() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="font-family:Arial,sans-serif;font-size:38px;line-height:38px;font-weight:900;letter-spacing:-2px;color:#ff7600">ATLAS</td><td style="padding-left:4px"><span style="display:inline-block;background:#08254a;color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;line-height:12px;padding:4px 3px;border-radius:2px;writing-mode:vertical-rl;transform:rotate(180deg)">one</span></td></tr></table>`;
}

export const recoveryCopy = {
  ru: { subjectFinal:"Напоминание о билетах",subjectFirst:"Вы не завершили покупку билетов",titleFinal:"Покупка не завершена",titleFirst:"Вы не завершили оформление",hello:"Здравствуйте",started:"Вы начали оформление билетов на",unfinished:"но не завершили оплату.",important:"Важно:",inventory:"Билеты и выбранные места не резервируются. Наличие, категория и цена могли измениться.",action:"Посмотреть доступные билеты",service:"Это сервисное сообщение о начатом вами оформлении. Оно не подписывает вас на рекламную рассылку.",optout:"Больше не напоминать об этой покупке" },
  he: { subjectFinal:"תזכורת לגבי הכרטיסים",subjectFirst:"לא השלמת את רכישת הכרטיסים",titleFinal:"הרכישה עדיין לא הושלמה",titleFirst:"נשאר רק להשלים את ההזמנה",hello:"שלום",started:"התחלת להזמין כרטיסים לאירוע",unfinished:"אך התשלום לא הושלם.",important:"חשוב:",inventory:"הכרטיסים והמקומות שבחרת אינם שמורים. ייתכן שהמלאי, הקטגוריה או המחיר השתנו.",action:"לצפייה בכרטיסים הזמינים",service:"זוהי הודעת שירות לגבי הזמנה שהתחלת. ההודעה אינה מצרפת אותך לרשימת דיוור שיווקית.",optout:"לא לשלוח עוד תזכורות לגבי ההזמנה הזו" },
  en: { subjectFinal:"Ticket reminder",subjectFirst:"You did not complete your ticket purchase",titleFinal:"Your purchase is not complete",titleFirst:"Your order is almost complete",hello:"Hello",started:"You started booking tickets for",unfinished:"but did not complete payment.",important:"Important:",inventory:"Tickets and selected seats are not reserved. Availability, category or price may have changed.",action:"View available tickets",service:"This is a service message about a checkout you started. It does not subscribe you to marketing messages.",optout:"Stop reminders about this purchase" },
} as const;

const recoverySmsCopy = {
  ru: { lead:"Atlas One: вы не завершили покупку билетов на", inventory:"Билеты, места и цена могли измениться.", action:"Продолжить", optout:"Не напоминать" },
  he: { lead:"Atlas One: לא השלמת את רכישת הכרטיסים לאירוע", inventory:"ייתכן שהכרטיסים, המקומות או המחיר השתנו.", action:"להמשך ההזמנה", optout:"להפסקת תזכורות" },
  en: { lead:"Atlas One: you did not complete your ticket purchase for", inventory:"Tickets, seats or price may have changed.", action:"Continue", optout:"Stop reminders" },
} as const;

const email: ChannelAdapter = {
  configured: () => Boolean(process.env.RESEND_API_KEY),
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_NOT_CONFIGURED");
    const final = message.templateKey === "FINAL_REMINDER";
    const c=recoveryCopy[message.communicationLocale];
    const greeting = message.firstName ? `${c.hello}, ${escapeHtml(message.firstName)}.` : `${c.hello}.`;
    const dir=message.communicationLocale==="he"?"rtl":"ltr";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [process.env.RESEND_TEST_TO || message.recipient],
        subject: `${final?c.subjectFinal:c.subjectFirst} - ${message.eventTitle}`,
        html: `<div lang="${message.communicationLocale}" dir="${dir}" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:#fff;padding:26px;border-radius:16px 16px 0 0">${atlasLogo()}<h1 style="margin:18px 0 0;font-size:28px">${final?c.titleFinal:c.titleFirst}</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>${greeting}</p><p>${c.started} <strong>${escapeHtml(message.eventTitle)}</strong>, ${c.unfinished}</p><p><strong>${c.important}</strong> ${c.inventory}</p><p style="text-align:center;margin:26px 0"><a href="${escapeHtml(message.checkoutUrl)}" style="display:inline-block;background:#ff7600;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">${c.action}</a></p><p style="font-size:12px;color:#6b7280">${c.service}</p><p style="font-size:12px"><a href="${escapeHtml(message.optOutUrl)}" style="color:#6b7280">${c.optout}</a></p></div></div>`,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `RESEND_${response.status}`);
    return { id: typeof payload?.id === "string" ? payload.id : undefined };
  },
};

const sms: ChannelAdapter = {
  configured: () => {
    const status = getSms019ConfigurationStatus();
    return status.username && status.token && status.source;
  },
  async send(message) {
    const c = recoverySmsCopy[message.communicationLocale];
    const body = `${c.lead} ${message.eventTitle}. ${c.inventory} ${c.action}: ${message.checkoutUrl} ${c.optout}: ${message.optOutUrl}`;
    const result = await sendSms019({
      phone: process.env.SMS_019_TEST_TO?.trim() || message.recipient,
      message: body,
      campaignName: `recovery-${message.templateKey.toLowerCase()}`,
    });
    if (!result.ok) throw new Error(result.providerMessage || `SMS_019_${result.status}`);
    return { id: result.providerStatus === undefined || result.providerStatus === null ? undefined : String(result.providerStatus) };
  },
};

const unavailable: ChannelAdapter = {
  configured: () => false,
  async send() { throw new Error("CHANNEL_NOT_CONFIGURED"); },
};

const adapters: Record<string, ChannelAdapter> = { EMAIL: email, SMS: sms, WHATSAPP: unavailable };

export function recoveryChannel(code: string) {
  return adapters[code] || unavailable;
}
