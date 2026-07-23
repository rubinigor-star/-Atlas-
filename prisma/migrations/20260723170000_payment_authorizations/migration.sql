CREATE TABLE "PaymentAuthorization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ILS',
  "cardLast4" TEXT,
  "authorizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedAt" DATETIME,
  "voidedAt" DATETIME,
  "expiresAt" DATETIME NOT NULL,
  "failureReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PaymentAuthorization_orderId_key" ON "PaymentAuthorization"("orderId");
CREATE UNIQUE INDEX "PaymentAuthorization_providerReference_key" ON "PaymentAuthorization"("providerReference");
CREATE INDEX "PaymentAuthorization_status_expiresAt_idx" ON "PaymentAuthorization"("status", "expiresAt");
