import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

type Executor = typeof db;

export type CheckoutConsentInput = {
  atlasMarketing: boolean;
  organizerMarketingAndClub: boolean;
};

export type ConsentProof = {
  locale: "ru" | "he" | "en";
  ipAddress: string | null;
  userAgent: string | null;
  atlasText: string;
  organizerText: string;
};

export const CHECKOUT_CONSENT_VERSION = "2026-08-20-v1";

let runtimeReady: Promise<void> | undefined;
export function ensureCheckoutConsentRuntime() {
  runtimeReady ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CheckoutConsentAcceptance" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "guestId" TEXT NOT NULL,
      "consentType" TEXT NOT NULL,
      "accepted" BOOLEAN NOT NULL,
      "consentTextVersion" TEXT NOT NULL,
      "consentText" TEXT NOT NULL,
      "locale" TEXT NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CheckoutConsentAcceptance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
      CONSTRAINT "CheckoutConsentAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
      CONSTRAINT "CheckoutConsentAcceptance_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile"("id") ON DELETE CASCADE
    )`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutConsentAcceptance_orderId_consentType_key" ON "CheckoutConsentAcceptance"("orderId","consentType")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CheckoutConsentAcceptance_guestId_acceptedAt_idx" ON "CheckoutConsentAcceptance"("guestId","acceptedAt")`);
  })().catch((error) => {
    runtimeReady = undefined;
    throw error;
  });
  return runtimeReady;
}

export function checkoutConsentTexts(locale: "ru" | "he" | "en") {
  if (locale === "he") return {
    atlas: "אני מאשר/ת קבלת מידע וחומר פרסומי מ-ATLAS",
    organizer: "אני מאשר/ת קבלת מידע וחומר פרסומי ממארגן/ת האירוע, מסכים/ה לתנאי מועדון הלקוחות שלו/ה, ואם איני חבר/ה עדיין - מאשר/ת את רישומי למועדון באמצעות מערכת הנאמנות המחוברת של המארגן/ת.",
  };
  if (locale === "en") return {
    atlas: "I agree to receive information and promotional materials from ATLAS",
    organizer: "I agree to receive information and promotional materials from the event organizer, accept the organizer's club terms, and, if I am not yet a member, authorize my registration in the organizer's club through the organizer's connected loyalty system.",
  };
  return {
    atlas: "Я согласен(на) получать информацию и рекламные материалы от ATLAS",
    organizer: "Я согласен(на) получать информацию и рекламные материалы от организатора мероприятия, принимаю условия его клубной программы и, если я ещё не являюсь участником, разрешаю зарегистрировать меня в клубе через подключённую организатором систему лояльности.",
  };
}

export async function saveCheckoutConsents(input: {
  executor: Executor;
  orderId: string;
  organizationId: string;
  guestId: string;
  consents: CheckoutConsentInput;
  proof: ConsentProof;
}) {
  const rows = [
    { type: "ATLAS_MARKETING", accepted: input.consents.atlasMarketing, text: input.proof.atlasText },
    { type: "ORGANIZER_MARKETING_AND_CLUB", accepted: input.consents.organizerMarketingAndClub, text: input.proof.organizerText },
  ];
  for (const row of rows) {
    await input.executor.$executeRawUnsafe(
      `INSERT INTO "CheckoutConsentAcceptance" ("id","orderId","organizationId","guestId","consentType","accepted","consentTextVersion","consentText","locale","ipAddress","userAgent","acceptedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP) ON CONFLICT ("orderId","consentType") DO NOTHING`,
      randomUUID(), input.orderId, input.organizationId, input.guestId, row.type, row.accepted, CHECKOUT_CONSENT_VERSION, row.text, input.proof.locale, input.proof.ipAddress, input.proof.userAgent,
    );
  }
}

export async function hasOrganizerClubConsent(orderId: string) {
  await ensureCheckoutConsentRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ accepted: boolean }>>(
    `SELECT "accepted" FROM "CheckoutConsentAcceptance" WHERE "orderId"=$1 AND "consentType"='ORGANIZER_MARKETING_AND_CLUB' LIMIT 1`,
    orderId,
  );
  return rows[0]?.accepted === true;
}
