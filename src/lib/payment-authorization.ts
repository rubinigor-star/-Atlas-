import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export type PaymentMethod = "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "PAYPAL";
export type AuthorizationStatus = "AUTHORIZED" | "CAPTURED" | "VOIDED" | "FAILED" | "EXPIRED";

export type PaymentInput = {
  method: PaymentMethod;
  cardNumber?: string;
  cardholderName?: string;
  expiry?: string;
  cvc?: string;
};

type AuthorizationRow = {
  id: string;
  providerReference: string;
  status: AuthorizationStatus;
  expiresAt: Date;
};

function normalizedCardNumber(value?: string) {
  return (value || "").replace(/\D/g, "");
}

export function validateTestAuthorization(input: PaymentInput) {
  if (input.method !== "CARD") return;
  const digits = normalizedCardNumber(input.cardNumber);
  if (digits === "4000000000000002") {
    throw new Error("Тестовая авторизация отклонена банком");
  }
  if (digits !== "4242424242424242") {
    throw new Error("Для успешного теста используйте карту 4242 4242 4242 4242");
  }
  if (!input.cardholderName?.trim()) throw new Error("Укажите имя владельца карты");
  if (!/^\d{2}\/\d{2}$/.test(input.expiry || "")) throw new Error("Укажите срок действия в формате MM/YY");
  if (!/^\d{3,4}$/.test(input.cvc || "")) throw new Error("Укажите CVC");
}

async function findAuthorization(orderId: string) {
  const rows = await db.$queryRaw<AuthorizationRow[]>`
    SELECT id, providerReference, status, expiresAt
    FROM PaymentAuthorization
    WHERE orderId = ${orderId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createTestAuthorization(params: {
  orderId: string;
  amountMinor: number;
  currency: string;
  input: PaymentInput;
  captureImmediately: boolean;
}) {
  if (!Number.isInteger(params.amountMinor) || params.amountMinor < 0) {
    throw new Error("Некорректная сумма авторизации");
  }

  const existing = await findAuthorization(params.orderId);
  if (existing) return existing;

  validateTestAuthorization(params.input);
  const id = `auth_${randomUUID().replace(/-/g, "")}`;
  const providerReference = `atlas_test_${randomUUID().replace(/-/g, "")}`;
  const status: AuthorizationStatus = params.captureImmediately ? "CAPTURED" : "AUTHORIZED";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const capturedAt = params.captureImmediately ? new Date() : null;
  const cardLast4 = params.input.method === "CARD" ? normalizedCardNumber(params.input.cardNumber).slice(-4) : null;

  try {
    await db.$executeRaw`
      INSERT INTO PaymentAuthorization (
        id, orderId, provider, providerReference, method, status,
        amountMinor, currency, cardLast4, authorizedAt, capturedAt, expiresAt, createdAt, updatedAt
      ) VALUES (
        ${id}, ${params.orderId}, 'ATLAS_TEST', ${providerReference}, ${params.input.method}, ${status},
        ${params.amountMinor}, ${params.currency}, ${cardLast4}, CURRENT_TIMESTAMP, ${capturedAt}, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    const concurrent = await findAuthorization(params.orderId);
    if (concurrent) return concurrent;
    throw error;
  }

  return { id, providerReference, status, expiresAt };
}

export async function captureTestAuthorization(orderId: string) {
  const now = new Date();
  const updated = await db.$executeRaw`
    UPDATE PaymentAuthorization
    SET status = 'CAPTURED', capturedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE orderId = ${orderId} AND status = 'AUTHORIZED' AND expiresAt >= ${now}
  `;

  const authorization = await findAuthorization(orderId);
  if (!authorization) throw new Error("Авторизация оплаты не найдена");
  if (authorization.status === "CAPTURED") return authorization;
  if (updated === 1) return { ...authorization, status: "CAPTURED" as const };

  if (authorization.status === "AUTHORIZED" && new Date(authorization.expiresAt) < now) {
    await db.$executeRaw`
      UPDATE PaymentAuthorization
      SET status = 'EXPIRED', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${authorization.id} AND status = 'AUTHORIZED'
    `;
    throw new Error("Срок авторизации оплаты истёк");
  }

  throw new Error("Авторизация недоступна для списания");
}

export async function voidTestAuthorization(orderId: string) {
  await db.$executeRaw`
    UPDATE PaymentAuthorization
    SET status = 'VOIDED', voidedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE orderId = ${orderId} AND status = 'AUTHORIZED'
  `;

  const authorization = await findAuthorization(orderId);
  if (!authorization) throw new Error("Авторизация оплаты не найдена");
  if (authorization.status === "VOIDED") return authorization;
  if (authorization.status === "CAPTURED") throw new Error("Списанную оплату нельзя отменить как авторизацию");
  if (authorization.status === "EXPIRED") throw new Error("Авторизация оплаты уже истекла");
  if (authorization.status === "FAILED") throw new Error("Неуспешную авторизацию нельзя отменить");
  return authorization;
}
