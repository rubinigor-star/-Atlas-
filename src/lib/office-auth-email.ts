import { createOfficeActionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGenericShortLink } from "@/lib/generic-short-link";
import { claimNotification, completeNotification, failNotification } from "@/lib/notification-ledger";
import { sendSms019 } from "@/lib/sms-019";
import { localeConfig, resolveStaffLocale, type Locale } from "@/lib/i18n";

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

const commonCopy = {
  ru: { footer: "Ссылка действует один час. Если вы не ожидали это письмо, проигнорируйте его." },
  he: { footer: "הקישור תקף למשך שעה. לא ציפיתם לקבל את המייל הזה? אפשר פשוט להתעלם ממנו." },
  en: { footer: "The link is valid for one hour. If you were not expecting this email, you can ignore it." },
} as const;

const verificationCopy = {
  ru: { subject: "Подтвердите email Atlas One", title: "Подтвердите рабочий email", text: "После подтверждения вы сможете войти в кабинет организатора и начать создавать мероприятия.", button: "Подтвердить email", sms: "Atlas One: подтвердите рабочий email. Ссылка действует 1 час:" },
  he: { subject: "אימות כתובת האימייל ב-Atlas One", title: "אימות כתובת האימייל לעבודה", text: "לאחר האימות תוכלו להיכנס למערכת הניהול ולהתחיל ליצור אירועים.", button: "אימות האימייל", sms: "Atlas One: לאימות כתובת האימייל לעבודה. הקישור תקף למשך שעה:" },
  en: { subject: "Verify your Atlas One email", title: "Verify your work email", text: "After verification, you can sign in to the organizer workspace and start creating events.", button: "Verify email", sms: "Atlas One: verify your work email. The link is valid for one hour:" },
} as const;

const resetCopy = {
  ru: { subject: "Восстановление доступа Atlas One", title: "Создайте новый пароль", text: "Мы получили запрос на восстановление доступа к кабинету организатора.", button: "Создать новый пароль", sms: "Atlas One: восстановление пароля. Ссылка действует 1 час:" },
  he: { subject: "איפוס סיסמה ב-Atlas One", title: "יצירת סיסמה חדשה", text: "קיבלנו בקשה לאיפוס הסיסמה למערכת הניהול.", button: "יצירת סיסמה חדשה", sms: "Atlas One: לאיפוס הסיסמה. הקישור תקף למשך שעה:" },
  en: { subject: "Reset your Atlas One password", title: "Create a new password", text: "We received a request to reset the password for your organizer workspace.", button: "Create new password", sms: "Atlas One: reset your password. The link is valid for one hour:" },
} as const;

const invitationCopy = {
  ru: { subject: (organization: string) => `Приглашение в ${organization} - Atlas One`, title: "Вас пригласили в Atlas One", text: (organization: string) => `Вам предоставлен рабочий доступ к организации «${organization}». Создайте личный пароль, чтобы активировать аккаунт сотрудника.`, button: "Активировать доступ" },
  he: { subject: (organization: string) => `הזמנה לצוות של ${organization} - Atlas One`, title: "הוזמנתם להצטרף ל-Atlas One", text: (organization: string) => `קיבלתם גישה לצוות של ${organization}. כדי להפעיל את חשבון העובד, צרו סיסמה אישית.`, button: "הפעלת החשבון" },
  en: { subject: (organization: string) => `Invitation to ${organization} - Atlas One`, title: "You have been invited to Atlas One", text: (organization: string) => `You have been given staff access to ${organization}. Create a personal password to activate your staff account.`, button: "Activate access" },
} as const;

async function staffLocaleFor(userId: string): Promise<Locale> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      interfaceLocaleOverride: true,
      preferredLocale: true,
      organization: { select: { defaultStaffLocale: true } },
    },
  });
  return resolveStaffLocale({
    memberOverride: user?.interfaceLocaleOverride,
    userPreference: user?.preferredLocale,
    organizationDefault: user?.organization?.defaultStaffLocale,
  });
}

async function send(to: string, locale: Locale, subject: string, title: string, bodyText: string, href: string, button: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend не настроен в Vercel");
  const settings = localeConfig[locale];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html: `<div lang="${settings.tag}" dir="${settings.dir}" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:28px"><div style="font-size:13px;letter-spacing:2px;color:#ff5947">ATLAS ONE OFFICE</div><h1>${escapeHtml(title)}</h1></div><div style="padding:28px;border:1px solid #e5e7eb"><p style="line-height:1.6">${escapeHtml(bodyText)}</p><p style="text-align:center;margin:28px 0"><a href="${href}" style="display:inline-block;background:#081426;color:white;text-decoration:none;padding:14px 22px;border-radius:10px">${escapeHtml(button)}</a></p><p style="font-size:12px;color:#6b7280">${commonCopy[locale].footer}</p></div></div>` }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`);
}

function phoneFromJobTitle(jobTitle: string | null) {
  if (!jobTitle) return null;
  const match = jobTitle.match(/(?:\+972|972|0)?5\d{8}/);
  return match?.[0] ?? null;
}

async function sendOrganizerAuthSms(userId: string, type: "VERIFY" | "RESET", targetPath: string, locale: Locale) {
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
  const message = `${type === "VERIFY" ? verificationCopy[locale].sms : resetCopy[locale].sms} ${shortUrl}`;
  const result = await sendSms019({ phone, message, campaignName: type === "VERIFY" ? "office-verify" : "office-reset" });
  if (result.ok) await completeNotification(claim.id!, { providerStatus: result.providerStatus, providerMessage: result.providerMessage });
  else await failNotification(claim.id!, result.providerMessage || `019SMS error ${result.status}`, result.providerStatus);
}

export async function sendOrganizerVerification(userId: string, email: string) {
  const locale = await staffLocaleFor(userId);
  const text = verificationCopy[locale];
  const token = createOfficeActionToken("verify", userId, email);
  const targetPath = `/api/office/auth/verify?token=${encodeURIComponent(token)}`;
  const href = `${baseUrl()}${targetPath}`;
  await send(email, locale, text.subject, text.title, text.text, href, text.button);
  try { await sendOrganizerAuthSms(userId, "VERIFY", targetPath, locale); } catch (error) { console.error("[office-verify-sms]", error); }
}

export async function sendOrganizerPasswordReset(userId: string, email: string) {
  const locale = await staffLocaleFor(userId);
  const text = resetCopy[locale];
  const token = createOfficeActionToken("reset", userId, email);
  const targetPath = `/office/reset-password?token=${encodeURIComponent(token)}`;
  const href = `${baseUrl()}${targetPath}`;
  await send(email, locale, text.subject, text.title, text.text, href, text.button);
  try { await sendOrganizerAuthSms(userId, "RESET", targetPath, locale); } catch (error) { console.error("[office-reset-sms]", error); }
}

export async function sendStaffInvitation(userId: string, email: string, organizationName: string) {
  const locale = await staffLocaleFor(userId);
  const text = invitationCopy[locale];
  const token = createOfficeActionToken("invite", userId, email);
  const targetPath = `/office/invite?token=${encodeURIComponent(token)}`;
  const href = `${baseUrl()}${targetPath}`;
  await send(
    email,
    locale,
    text.subject(organizationName),
    text.title,
    text.text(organizationName),
    href,
    text.button,
  );
}
