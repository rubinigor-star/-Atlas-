import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "PaymentAuthorization" (
    "id" TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL UNIQUE,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL UNIQUE,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "cardLast4" TEXT,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTransId" TEXT`,
  `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypAuthorizationTransId" TEXT`,
  `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCaptureTransId" TEXT`,
  `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCancelTransId" TEXT`,
  `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCapturePayloadJson" TEXT`,
  `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCancelPayloadJson" TEXT`,
  `CREATE INDEX IF NOT EXISTS "PaymentAuthorization_status_expiresAt_idx"
    ON "PaymentAuthorization"("status", "expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx"
    ON "Reservation"("status", "expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "ReservationItem" (
    "id" TEXT PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tableId" TEXT,
    "seatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationItem_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ReservationItem_categoryId_idx"
    ON "ReservationItem"("categoryId")`,
  `CREATE INDEX IF NOT EXISTS "ReservationItem_tableId_idx"
    ON "ReservationItem"("tableId")`,
  `CREATE INDEX IF NOT EXISTS "ReservationItem_seatId_idx"
    ON "ReservationItem"("seatId")`,
  `CREATE TABLE IF NOT EXISTS "ReservationClaim" (
    "id" TEXT PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "tableId" TEXT,
    "seatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationClaim_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReservationClaim_tableId_key"
    ON "ReservationClaim"("tableId") WHERE "tableId" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReservationClaim_seatId_key"
    ON "ReservationClaim"("seatId") WHERE "seatId" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "ReservationClaim_reservationId_idx"
    ON "ReservationClaim"("reservationId")`,
  `CREATE TABLE IF NOT EXISTS "ReservationInventoryLock" (
    "categoryId" TEXT PRIMARY KEY,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "salesFlow" TEXT NOT NULL DEFAULT 'DIRECT'`,
  `UPDATE "Order" o
   SET "salesFlow"='APPROVAL'
   WHERE o."salesFlow"='DIRECT'
     AND (
       o."status" IN ('PENDING_APPROVAL','REJECTED')
       OR EXISTS (
         SELECT 1 FROM "AuditLog" a
         WHERE a."entityType"='Order'
           AND a."entityId"=o."id"
           AND a."action" IN (
             'REQUEST_APPROVED_AND_CAPTURED',
             'REQUEST_REJECTED_WITHOUT_COMMIT',
             'LEGACY_REQUEST_APPROVED',
             'REQUEST_CAPTURE_RECOVERED'
           )
       )
     )`,
  `CREATE INDEX IF NOT EXISTS "Order_salesFlow_status_createdAt_idx"
    ON "Order"("salesFlow", "status", "createdAt")`,
  `CREATE OR REPLACE FUNCTION atlas_assign_order_sales_flow()
   RETURNS trigger AS $$
   BEGIN
     SELECT CASE WHEN e."salesMode"='APPROVAL_REQUIRED' THEN 'APPROVAL' ELSE 'DIRECT' END
       INTO NEW."salesFlow"
       FROM "Event" e
       WHERE e."id"=NEW."eventId";
     IF NEW."salesFlow" IS NULL THEN NEW."salesFlow":='DIRECT'; END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS atlas_assign_order_sales_flow_trigger ON "Order"`,
  `CREATE TRIGGER atlas_assign_order_sales_flow_trigger
   BEFORE INSERT ON "Order"
   FOR EACH ROW EXECUTE FUNCTION atlas_assign_order_sales_flow()`,
  `CREATE OR REPLACE FUNCTION atlas_prevent_order_sales_flow_change()
   RETURNS trigger AS $$
   BEGIN
     IF NEW."salesFlow" IS DISTINCT FROM OLD."salesFlow" THEN
       RAISE EXCEPTION 'Order.salesFlow is immutable';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS atlas_prevent_order_sales_flow_change_trigger ON "Order"`,
  `CREATE TRIGGER atlas_prevent_order_sales_flow_change_trigger
   BEFORE UPDATE ON "Order"
   FOR EACH ROW EXECUTE FUNCTION atlas_prevent_order_sales_flow_change()`,
];

try {
  for (const statement of statements) {
    await db.$executeRawUnsafe(statement);
  }
  console.log("Payment, reservation, and immutable order sales-flow runtime are ready.");
} finally {
  await db.$disconnect();
}
