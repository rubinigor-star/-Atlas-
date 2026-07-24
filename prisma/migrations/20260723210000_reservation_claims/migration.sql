CREATE TABLE "ReservationClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "tableId" TEXT,
  "seatId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationClaim_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ReservationInventoryLock" (
  "categoryId" TEXT NOT NULL PRIMARY KEY,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ReservationClaim_tableId_key"
ON "ReservationClaim"("tableId")
WHERE "tableId" IS NOT NULL;

CREATE UNIQUE INDEX "ReservationClaim_seatId_key"
ON "ReservationClaim"("seatId")
WHERE "seatId" IS NOT NULL;

CREATE INDEX "ReservationClaim_reservationId_idx" ON "ReservationClaim"("reservationId");
