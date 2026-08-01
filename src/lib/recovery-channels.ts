type RecoveryMessage = {
  recipient: string;
  firstName?: string | null;
  eventTitle: string;
  checkoutUrl: string;
  optOutUrl: string;
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

function atlasLogo() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="font-family:Arial,sans-serif;font-size:38px;line-height:38px;font-weight:900;letter-spacing:-2px;color:#ff7600">ATLAS</td><td style="padding-left:4px"><span style="display:inline-block;background:#08254a;color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;line-height:12px;padding:4px 3px;border-radius:2px;writing-mode:vertical-rl;transform:rotate(180deg)">one</span></td></tr></table>`;
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
        subject: final ? `Напоминание о билетах на ${message.eventTitle}` : `Вы не завершили покупку билетов на ${message.eventTitle}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:#fff;padding:26px;border-radius:16px 16px 0 0">${atlasLogo()}<h1 style="margin:18px 0 0;font-size:28px">${final ? "Покупка не завершена" : "Вы не завершили оформление"}</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>${greeting}</p><p>Вы начали оформление билетов на <strong>${escapeHtml(message.eventTitle)}</strong>, но не завершили оплату.</p><p><strong>Важно:</strong> билеты и выбранные места не резервируются. Наличие, категория и цена могли измениться.</p><p style="text-align:center;margin:26px 0"><a href="${escapeHtml(message.checkoutUrl)}" style="display:inline-block;background:#ff7600;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Посмотреть доступные билеты</a></p><p style="font-size:12px;color:#6b7280">Это сервисное сообщение о начатом вами оформлении. Оно не подписывает вас на рекламную рассылку.</p><p style="font-size:12px"><a href="${escapeHtml(message.optOutUrl)}" style="color:#6b7280">Больше не напоминать об этой покупке</a></p></div></div>`,
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
