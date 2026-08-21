import { createOfficeActionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGenericShortLink } from "@/lib/generic-short-link";
import { claimNotification, completeNotification, failNotification } from "@/lib/notification-ledger";
import { sendSms019 } from "@/lib/sms-019";

const DEFAULT_PUBLIC_APP_URL = "https://www.atlas-one.co";

function baseUrl() {
  // Transactional auth emails must never expose a Vercel preview/deployment URL.
  // A staff invitation can be triggered while an operator is testing a preview,
  // but the recipient should always activate their account on the canonical Atlas domain.
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return (process.env.PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL).replace(/\/$/, "");
  }
  return (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char] || char); }

async function send(to: string, subject: string, title: string, text: string, href: string, button: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend не настроен в Vercel");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:28px"><div style="font-size:13px;letter-spacing:2px;color:#ff5947">ATLAS ONE OFFICE</div><h1>${escapeHtml(title)}</h1></div><div style="padding:28px;border:1px solid #e5e7eb"><p style="line-height:1.6">${escapeHtml(text)}</p><p style="text-align:center;margin:28px 0"><a href="${href}" style="display:inline-block;background:#081426;color:white;text-decoration:none;padding:14px 22px;border-radius:10px">${escapeHtml(button)}</a></p><p style="font-size:12px;color:#6b7280">Ссылка действует один час. Если вы не ожидали это письмо, проигнорируйте его.</p></div></div>` }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`);
}

function phoneFromJobTitle(jobTitle: string | null) {
  if (!jobTitle) return null;
  const match = jobTitle.match(/(?:\+972|972|0)?5\d{8}/);
  return match?.[0] ?? null;
}

async function sendOrganizerAuthSms(userId: string, type: "VERIFY" | "RESET", targetPath: string) {
  if (!process.env.SMS_019_API_TOKEN) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { jobTitle: true, organizationId: true } });
  const phone = phoneFromJobTitle(user?.jobTitle ?? null);
  if (!phone) return;

  const rateBucket = Math.floor(Date.now() / (2 * 60_000));
  const claim = await claimNotification({
    dedupeKey: `organizer-auth-sms:${type}:${userId}:${rateBucket}`,
    channel: "SMS",
    type: type === "VERIFY" ? "ORGANIZER_VERIFY" : "ORGANIZER_PASSWORD_RESET",
    recipient: phone,
    organizationId: user?.organizationId ?? null,
    priceMinor: 0,
    metadata: { userId },
  });
  if (!claim.claimed) return;

  const shortUrl = await createGenericShortLink({ targetPath, expiresAt: new Date(Date.now() + 60 * 60_000), singleUse: true });
  const message = type === "VERIFY"
    ? `Atlas One: подтвердите email организатора. Ссылка действует 1 час: ${shortUrl}`
    : `Atlas One: восстановление пароля организатора. Ссылка действует 1 час: ${shortUrl}`;
  const result = await sendSms019({ phone, message, campaignName: type === "VERIFY" ? "office-verify" : "office-reset" });
  if (result.ok) await completeNotification(claim.id!, { providerStatus: result.providerStatus, providerMessage: result.providerMessage });
  else await failNotification(claim.id!, result.providerMessage || `019SMS error ${result.status}`, result.providerStatus);
}

export async function sendOrganizerVerification(userId: string, email: string) {
  const token = createOfficeActionToken("verify", userId, email);
  const targetPath = `/api/office/auth/verify?token=${encodeURIComponent(token)}`;
  const href = `${baseUrl()}${targetPath}`;
  await send(email, "Подтвердите email Atlas One", "Подтвердите рабочий email", "После подтверждения вы сможете войти в кабинет организатора и начать создавать мероприятия.", href, "Подтвердить email");
  try { await sendOrganizerAuthSms(userId, "VERIFY", targetPath); } catch (error) { console.error("[office-verify-sms]", error); }
}

export async function sendOrganizerPasswordReset(userId: string, email: string) {
  const token = createOfficeActionToken("reset", userId, email);
  const targetPath = `/office/reset-password?token=${encodeURIComponent(token)}`;
  const href = `${baseUrl()}${targetPath}`;
  await send(email, "Восстановление доступа Atlas One", "Создайте новый пароль", "Мы получили запрос на восстановление доступа к кабинету организатора.", href, "Создать новый пароль");
  try { await sendOrganizerAuthSms(userId, "RESET", targetPath); } catch (error) { console.error("[office-reset-sms]", error); }
}

export async function sendStaffInvitation(userId: string, email: string, organizationName: string) {
  const token = createOfficeActionToken("invite", userId, email);
  const targetPath = `/office/invite?token=${encodeURIComponent(token)}`;
  const href = `${baseUrl()}${targetPath}`;
  await send(
    email,
    `Приглашение в ${organizationName} - Atlas One`,
    "Вас пригласили в Atlas One",
    `Вам предоставлен рабочий доступ к организации «${organizationName}». Создайте личный пароль, чтобы активировать аккаунт сотрудника.`,
    href,
    "Активировать доступ",
  );
}
