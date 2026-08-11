import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCb);
const SESSION_COOKIE = "atlas_promoter_session";
const PUBLIC_ORIGIN = (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
let ready: Promise<void> | null = null;

export type PromoterAccountState = "NOT_INVITED" | "PENDING" | "ACTIVE" | "DISABLED";

type AccountRow = {
  promoterId: string;
  email: string;
  passwordHash: string | null;
  status: PromoterAccountState;
  activatedAt: Date | null;
  lastLoginAt: Date | null;
};

export async function ensurePromoterAuthRuntime() {
  if (!ready) ready = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterAccount" (
      "promoterId" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "activatedAt" TIMESTAMP(3),
      "lastLoginAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromoterAccount_email_key" ON "PromoterAccount"(LOWER("email"))`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterAuthToken" (
      "id" TEXT PRIMARY KEY,
      "promoterId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "purpose" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoterAuthToken_promoter_purpose_idx" ON "PromoterAuthToken"("promoterId","purpose","expiresAt")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterSession" (
      "id" TEXT PRIMARY KEY,
      "promoterId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoterSession_promoter_idx" ON "PromoterSession"("promoterId","expiresAt")`);
  })().catch(error => { ready = null; throw error; });
  return ready;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  if (password.length < 8) throw new Error("Пароль должен содержать минимум 8 символов");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, storedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHex) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const stored = Buffer.from(storedHex, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export async function getPromoterAccount(promoterId: string) {
  await ensurePromoterAuthRuntime();
  const rows = await db.$queryRawUnsafe<AccountRow[]>(`SELECT "promoterId","email","passwordHash","status","activatedAt","lastLoginAt" FROM "PromoterAccount" WHERE "promoterId"=$1 LIMIT 1`, promoterId);
  return rows[0] || null;
}

export async function getPromoterAccountStates(promoterIds: string[]) {
  await ensurePromoterAuthRuntime();
  if (!promoterIds.length) return new Map<string, AccountRow>();
  const rows = await db.$queryRawUnsafe<AccountRow[]>(`SELECT "promoterId","email","passwordHash","status","activatedAt","lastLoginAt" FROM "PromoterAccount" WHERE "promoterId" = ANY($1::text[])`, promoterIds);
  return new Map(rows.map(row => [row.promoterId, row]));
}

async function issueToken(promoterId: string, purpose: "ACTIVATION" | "RESET", hours: number) {
  await ensurePromoterAuthRuntime();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db.$executeRawUnsafe(`UPDATE "PromoterAuthToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE "promoterId"=$1 AND "purpose"=$2 AND "usedAt" IS NULL`, promoterId, purpose);
  await db.$executeRawUnsafe(`INSERT INTO "PromoterAuthToken" ("id","promoterId","tokenHash","purpose","expiresAt") VALUES ($1,$2,$3,$4,$5)`, randomBytes(16).toString("hex"), promoterId, tokenHash, purpose, expiresAt);
  return token;
}

function fromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && !configured.startsWith("re_") && configured.includes("@") ? configured : "Atlas One <tickets@mail.atlas-one.co>";
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");
  const recipient = process.env.RESEND_TEST_TO || to;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromAddress(), to: [recipient], subject, html }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[char] || char);
}

export async function invitePromoterAccount(promoterId: string, force = false) {
  await ensurePromoterAuthRuntime();
  const promoter = await db.promoter.findUnique({ where: { id: promoterId }, include: { organization: true } });
  if (!promoter || !promoter.active || promoter.name.startsWith("__")) throw new Error("Промоутер не найден или архивирован");
  if (!promoter.email) throw new Error("У промоутера не указан email");
  const normalizedEmail = promoter.email.trim().toLowerCase();
  const existing = await getPromoterAccount(promoter.id);
  if (existing?.status === "ACTIVE" && !force) return { status: "ACTIVE" as const };
  await db.$executeRawUnsafe(`INSERT INTO "PromoterAccount" ("promoterId","email","status","updatedAt") VALUES ($1,$2,'PENDING',CURRENT_TIMESTAMP)
    ON CONFLICT ("promoterId") DO UPDATE SET "email"=EXCLUDED."email","status"=CASE WHEN "PromoterAccount"."status"='ACTIVE' THEN 'ACTIVE' ELSE 'PENDING' END,"updatedAt"=CURRENT_TIMESTAMP`, promoter.id, normalizedEmail);
  const token = await issueToken(promoter.id, "ACTIVATION", 72);
  const activateUrl = `${PUBLIC_ORIGIN}/promoter/activate?token=${encodeURIComponent(token)}`;
  await sendEmail(normalizedEmail, "Добро пожаловать в Atlas One - активируйте аккаунт промоутера", `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:Arial,sans-serif;color:#101828"><div style="max-width:620px;margin:auto;background:#fff;border-radius:18px;overflow:hidden"><div style="background:#081426;color:#fff;padding:28px"><div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.7">Atlas One · Promoter</div><h1 style="margin:10px 0 0;font-size:26px">Добро пожаловать в Atlas One</h1></div><div style="padding:28px"><p>Привет, ${escapeHtml(promoter.name)}!</p><p>Организация <strong>${escapeHtml(promoter.organization.name)}</strong> добавила вас как промоутера в Atlas One.</p><p>В вашем защищённом кабинете будут доступны ваши мероприятия, персональные ссылки продаж и статистика по вашим продажам.</p><p>Для первого входа создайте свой пароль. Ссылка активации действует 72 часа и может быть использована только один раз.</p><div style="text-align:center;margin:28px 0"><a href="${activateUrl}" style="display:inline-block;background:#ff5c45;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Активировать аккаунт</a></div><p style="font-size:13px;color:#667085">После активации вход выполняется только по email и вашему паролю.</p></div></div></body></html>`);
  return { status: "PENDING" as const };
}

export async function validateAuthToken(token: string, purpose: "ACTIVATION" | "RESET") {
  await ensurePromoterAuthRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ promoterId: string; expiresAt: Date; usedAt: Date | null }>>(`SELECT "promoterId","expiresAt","usedAt" FROM "PromoterAuthToken" WHERE "tokenHash"=$1 AND "purpose"=$2 LIMIT 1`, hashToken(token), purpose);
  const row = rows[0];
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return null;
  return row.promoterId;
}

export async function activatePromoterAccount(token: string, password: string) {
  const promoterId = await validateAuthToken(token, "ACTIVATION");
  if (!promoterId) throw new Error("Ссылка активации недействительна или истекла");
  const passwordHash = await hashPassword(password);
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "PromoterAccount" SET "passwordHash"=$2,"status"='ACTIVE',"activatedAt"=COALESCE("activatedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE "promoterId"=$1`, promoterId, passwordHash);
    await tx.$executeRawUnsafe(`UPDATE "PromoterAuthToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE "tokenHash"=$1 AND "purpose"='ACTIVATION'`, hashToken(token));
  });
  return promoterId;
}

export async function createPromoterSession(promoterId: string) {
  await ensurePromoterAuthRuntime();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.$executeRawUnsafe(`INSERT INTO "PromoterSession" ("id","promoterId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4)`, randomBytes(16).toString("hex"), promoterId, tokenHash, expiresAt);
  await db.$executeRawUnsafe(`UPDATE "PromoterAccount" SET "lastLoginAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "promoterId"=$1`, promoterId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function loginPromoter(email: string, password: string) {
  await ensurePromoterAuthRuntime();
  const rows = await db.$queryRawUnsafe<AccountRow[]>(`SELECT "promoterId","email","passwordHash","status","activatedAt","lastLoginAt" FROM "PromoterAccount" WHERE LOWER("email")=LOWER($1) LIMIT 1`, email.trim());
  const account = rows[0];
  if (!account || account.status !== "ACTIVE" || !account.passwordHash || !(await verifyPassword(password, account.passwordHash))) throw new Error("Неверный email или пароль");
  const promoter = await db.promoter.findUnique({ where: { id: account.promoterId } });
  if (!promoter || !promoter.active) throw new Error("Доступ к кабинету отключён");
  await createPromoterSession(account.promoterId);
  return account.promoterId;
}

export async function requestPromoterPasswordReset(email: string) {
  await ensurePromoterAuthRuntime();
  const rows = await db.$queryRawUnsafe<AccountRow[]>(`SELECT "promoterId","email","passwordHash","status","activatedAt","lastLoginAt" FROM "PromoterAccount" WHERE LOWER("email")=LOWER($1) LIMIT 1`, email.trim());
  const account = rows[0];
  if (!account || account.status !== "ACTIVE") return;
  const token = await issueToken(account.promoterId, "RESET", 2);
  const resetUrl = `${PUBLIC_ORIGIN}/promoter/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail(account.email, "Сброс пароля Atlas One", `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px"><h1>Сброс пароля</h1><p>Мы получили запрос на изменение пароля вашего кабинета промоутера Atlas One.</p><p><a href="${resetUrl}" style="display:inline-block;background:#ff5c45;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Создать новый пароль</a></p><p style="color:#667085;font-size:13px">Ссылка действует 2 часа. Если запрос сделали не вы, ничего делать не нужно.</p></div></body></html>`);
}

export async function resetPromoterPassword(token: string, password: string) {
  const promoterId = await validateAuthToken(token, "RESET");
  if (!promoterId) throw new Error("Ссылка сброса недействительна или истекла");
  const passwordHash = await hashPassword(password);
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "PromoterAccount" SET "passwordHash"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "promoterId"=$1`, promoterId, passwordHash);
    await tx.$executeRawUnsafe(`UPDATE "PromoterAuthToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE "tokenHash"=$1 AND "purpose"='RESET'`, hashToken(token));
    await tx.$executeRawUnsafe(`DELETE FROM "PromoterSession" WHERE "promoterId"=$1`, promoterId);
  });
  return promoterId;
}

export async function currentPromoter() {
  await ensurePromoterAuthRuntime();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db.$queryRawUnsafe<Array<{ promoterId: string }>>(`SELECT "promoterId" FROM "PromoterSession" WHERE "tokenHash"=$1 AND "expiresAt">CURRENT_TIMESTAMP LIMIT 1`, hashToken(token));
  const promoterId = rows[0]?.promoterId;
  if (!promoterId) return null;
  const promoter = await db.promoter.findUnique({ where: { id: promoterId }, include: { organization: true } });
  if (!promoter || !promoter.active || promoter.name.startsWith("__")) return null;
  await db.$executeRawUnsafe(`UPDATE "PromoterSession" SET "lastSeenAt"=CURRENT_TIMESTAMP WHERE "tokenHash"=$1`, hashToken(token));
  return promoter;
}

export async function requirePromoter() {
  const promoter = await currentPromoter();
  if (!promoter) redirect("/promoter/login");
  return promoter;
}

export async function logoutPromoter() {
  await ensurePromoterAuthRuntime();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.$executeRawUnsafe(`DELETE FROM "PromoterSession" WHERE "tokenHash"=$1`, hashToken(token));
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(0) });
}
