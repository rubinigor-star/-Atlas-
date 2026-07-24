CREATE TABLE "Reservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" DATETIME NOT NULL,
  "committedAt" DATETIME,
  "releasedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ReservationItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "tableId" TEXT,
  "seatId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Reservation_orderId_key" ON "Reservation"("orderId");
CREATE INDEX "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");
CREATE INDEX "ReservationItem_categoryId_idx" ON "ReservationItem"("categoryId");
CREATE INDEX "ReservationItem_tableId_idx" ON "ReservationItem"("tableId");
CREATE INDEX "ReservationItem_seatId_idx" ON "ReservationItem"("seatId");