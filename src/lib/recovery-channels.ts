type RecoveryMessage = {
  recipient: string;
  firstName?: string | null;
  eventTitle: string;
  checkoutUrl: string;
  amountMinor: number;
  templateKey: string;
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

const email: ChannelAdapter = {
  configured: () => Boolean(process.env.RESEND_API_KEY),
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_NOT_CONFIGURED");
    const final = message.templateKey === "FINAL_REMINDER";
    const greeting = message.firstName ? `Здравствуйте, ${escapeHtml(message.firstName)}.` : "Здравствуйте.";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [process.env.RESEND_TEST_TO || message.recipient],
        subject: final ? `Последнее напоминание: ${message.eventTitle}` : `Ваш заказ на ${message.eventTitle} ещё ждёт вас`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:#fff;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px;color:#ff7a18">ATLAS ONE</div><h1 style="margin:10px 0 0">${final ? "Билеты ещё доступны" : "Вы не завершили покупку"}</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>${greeting}</p><p>Вы выбрали билеты на <strong>${escapeHtml(message.eventTitle)}</strong>, но покупка не была завершена.</p><p>Наличие и цена могут измениться, поэтому рекомендуем вернуться к оформлению, если мероприятие вам ещё интересно.</p><p style="text-align:center;margin:26px 0"><a href="${escapeHtml(message.checkoutUrl)}" style="display:inline-block;background:#ff7a18;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Продолжить покупку</a></p><p style="font-size:12px;color:#6b7280">Это сервисное напоминание о начатом оформлении. Оно не подписывает вас на рекламную рассылку.</p></div></div>`,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `RESEND_${response.status}`);
    return { id: typeof payload?.id === "string" ? payload.id : undefined };
  },
};

const unavailable: ChannelAdapter = {
  configured: () => false,
  async send() { throw new Error("CHANNEL_NOT_CONFIGURED"); },
};

const adapters: Record<string, ChannelAdapter> = { EMAIL: email, SMS: unavailable, WHATSAPP: unavailable };

export function recoveryChannel(code: string) {
  return adapters[code] || unavailable;
}
