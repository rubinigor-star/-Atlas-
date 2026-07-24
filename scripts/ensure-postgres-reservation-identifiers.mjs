import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS paymentauthorization (
    id TEXT PRIMARY KEY,
    orderid TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    providerreference TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    amountminor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    cardlast4 TEXT,
    authorizedat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    capturedat TIMESTAMP(3),
    voidedat TIMESTAMP(3),
    expiresat TIMESTAMP(3) NOT NULL,
    failurereason TEXT,
    createdat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS paymentauthorization_status_expiresat_idx
    ON paymentauthorization(status, expiresat)`,
  `CREATE TABLE IF NOT EXISTS reservation (
    id TEXT PRIMARY KEY,
    orderid TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    expiresat TIMESTAMP(3) NOT NULL,
    committedat TIMESTAMP(3),
    releasedat TIMESTAMP(3),
    createdat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS reservation_status_expiresat_idx
    ON reservation(status, expiresat)`,
  `CREATE TABLE IF NOT EXISTS reservationitem (
    id TEXT PRIMARY KEY,
    reservationid TEXT NOT NULL,
    categoryid TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    tableid TEXT,
    seatid TEXT,
    createdat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reservationitem_reservationid_fkey
      FOREIGN KEY (reservationid) REFERENCES reservation(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS reservationitem_categoryid_idx ON reservationitem(categoryid)`,
  `CREATE INDEX IF NOT EXISTS reservationitem_tableid_idx ON reservationitem(tableid)`,
  `CREATE INDEX IF NOT EXISTS reservationitem_seatid_idx ON reservationitem(seatid)`,
  `CREATE TABLE IF NOT EXISTS reservationclaim (
    id TEXT PRIMARY KEY,
    reservationid TEXT NOT NULL,
    tableid TEXT,
    seatid TEXT,
    createdat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reservationclaim_reservationid_fkey
      FOREIGN KEY (reservationid) REFERENCES reservation(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reservationclaim_tableid_key
    ON reservationclaim(tableid) WHERE tableid IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reservationclaim_seatid_key
    ON reservationclaim(seatid) WHERE seatid IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS reservationclaim_reservationid_idx
    ON reservationclaim(reservationid)`,
  `CREATE TABLE IF NOT EXISTS reservationinventorylock (
    categoryid TEXT PRIMARY KEY,
    updatedat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

try {
  for (const statement of statements) await db.$executeRawUnsafe(statement);
  console.log("PostgreSQL raw-query reservation identifiers are ready.");
} finally {
  await db.$disconnect();
}
