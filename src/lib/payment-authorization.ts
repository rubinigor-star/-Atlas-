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

type SqlExecutor = {
  $executeRaw: typeof db.$executeRaw;
  $queryRaw: typeof db.$queryRaw;
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

export async function createTestAuthorization(params: {
  orderId: string;
  amountMinor: number;
  currency: string;
  input: PaymentInput;
  captureImmediately: boolean;
  executor?: SqlExecutor;
}) {
  validateTestAuthorization(params.input);
  const executor = params.executor ?? db;
  const existing = await executor.$queryRaw<Array<{
    id: string;
    providerReference: string;
    status: AuthorizationStatus;
    expiresAt: Date;
    amountMinor: number;
    currency: string;
  }>>`SELECT id, providerReference, status, expiresAt, amountMinor, currency FROM PaymentAuthorization WHERE orderId = ${params.orderId} LIMIT 1`;

  if (existing[0]) {
    if (existing[0].amountMinor !== params.amountMinor || existing[0].currency !== params.currency) {
      throw new Error("Сумма существующей авторизации не совпадает с заказом");
    }
    return existing[0];
  }

  const id = `auth_${randomUUID().replace(/-/g, "")}`;
  const providerReference = `atlas_test_${randomUUID().replace(/-/g, "")}`;
  const status: AuthorizationStatus = params.captureImmediately ? "CAPTURED" : "AUTHORIZED";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const capturedAt = params.captureImmediately ? new Date() : null;
  const cardLast4 = params.input.method === "CARD" ? normalizedCardNumber(params.input.cardNumber).slice(-4) : null;

  try {
    await executor.$executeRaw`
      INSERT INTO PaymentAuthorization (
        id, orderId, provider, providerReference, method, status,
        amountMinor, currency, cardLast4, authorizedAt, capturedAt, expiresAt, createdAt, updatedAt
      ) VALUES (
        ${id}, ${params.orderId}, 'ATLAS_TEST', ${providerReference}, ${params.input.method}, ${status},
        ${params.amountMinor}, ${params.currency}, ${cardLast4}, CURRENT_TIMESTAMP, ${capturedAt}, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    const concurrent = await executor.$queryRaw<Array<{
      id: string;
      providerReference: string;
      status: AuthorizationStatus;
      expiresAt: Date;
      amountMinor: number;
      currency: string;
    }>>`SELECT id, providerReference, status, expiresAt, amountMinor, currency FROM PaymentAuthorization WHERE orderId = ${params.orderId} LIMIT 1`;
    if (concurrent[0]) return concurrent[0];
    throw error;
  }

  return { id, providerReference, status, expiresAt, amountMinor: params.amountMinor, currency: params.currency };
}

export async function captureTestAuthorization(orderId: string, executor: SqlExecutor = db) {
  const rows = await executor.$queryRaw<Array<{
    id: string;
    status: AuthorizationStatus;
    expiresAt: Date;
    amountMinor: number;
    currency: string;
  }>>`SELECT id, status, expiresAt, amountMinor, currency FROM PaymentAuthorization WHERE orderId = ${orderId} LIMIT 1`;
  const authorization = rows[0];
  if (!authorization) throw new Error("Авторизация оплаты не найдена");
  if (authorization.status === "CAPTURED") return authorization;
  if (authorization.status !== "AUTHORIZED") throw new Error("Авторизация недоступна для списания");
  if (new Date(authorization.expiresAt) < new Date()) {
    await executor.$executeRaw`UPDATE PaymentAuthorization SET status = 'EXPIRED', updatedAt = CURRENT_TIMESTAMP WHERE id = ${authorization.id} AND status = 'AUTHORIZED'`;
    throw new Error("Срок авторизации оплаты истёк");
  }

  const changed = await executor.$executeRaw`
    UPDATE PaymentAuthorization
    SET status = 'CAPTURED', capturedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${authorization.id} AND status = 'AUTHORIZED'
  `;
  if (changed !== 1) {
    const refreshed = await executor.$queryRaw<Array<{ status: AuthorizationStatus }>>`SELECT status FROM PaymentAuthorization WHERE id = ${authorization.id} LIMIT 1`;
    if (refreshed[0]?.status !== "CAPTURED") throw new Error("Авторизация была изменена другой операцией");
  }
  return { ...authorization, status: "CAPTURED" as const };
}

export async function voidTestAuthorization(orderId: string, executor: SqlExecutor = db) {
  const rows = await executor.$queryRaw<Array<{ id: string; status: AuthorizationStatus }>>`
    SELECT id, status FROM PaymentAuthorization WHERE orderId = ${orderId} LIMIT 1
  `;
  const authorization = rows[0];
  if (!authorization) throw new Error("Авторизация оплаты не найдена");
  if (authorization.status === "VOIDED") return authorization;
  if (authorization.status !== "AUTHORIZED") throw new Error("Авторизация недоступна для отмены");

  const changed = await executor.$executeRaw`
    UPDATE PaymentAuthorization
    SET status = 'VOIDED', voidedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${authorization.id} AND status = 'AUTHORIZED'
  `;
  if (changed !== 1) throw new Error("Авторизация была изменена другой операцией");
  return { ...authorization, status: "VOIDED" as const };
}
