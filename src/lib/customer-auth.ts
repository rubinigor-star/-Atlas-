import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "atlas_customer_session";
const TTL_SECONDS = 60 * 60 * 24 * 30;
const MAGIC_LINK_TTL_SECONDS = 60 * 15;

type CustomerSession = {
  email: string;
  expiresAt: number;
};

function secret() {
  return process.env.CUSTOMER_AUTH_SECRET || process.env.CRON_SECRET || "atlas-local-customer-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(email: string, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ email: email.toLowerCase(), expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): CustomerSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown; expiresAt?: unknown };
    if (typeof parsed.email !== "string" || typeof parsed.expiresAt !== "number") return null;
    if (!parsed.email.trim() || parsed.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return { email: parsed.email.toLowerCase(), expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function createCustomerMagicToken(email: string) {
  return encode(email, Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS);
}

export function verifyCustomerMagicToken(token: string) {
  return decode(token);
}

export async function createCustomerSession(email: string) {
  const store = await cookies();
  store.set(COOKIE, encode(email, Math.floor(Date.now() / 1000) + TTL_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCustomerSession() {
  const store = await cookies();
  return decode(store.get(COOKIE)?.value || "");
}
