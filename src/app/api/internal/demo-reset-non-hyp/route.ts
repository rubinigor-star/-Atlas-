import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const TOKEN = "atlas-demo-reset-20260812-X7K9Q2";

async function tableExists(name: string) {
  const rows = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass($1) IS NOT NULL AS "exists"`,
    `public.${name}`,
  );
  return Boolean(rows[0]?.exists);
}

async function candidateIds() {
  return db.$queryRawUnsafe<Array<{ id: string; publicId: string; status: string; totalMinor: number; createdAt: Date }>>(
    `SELECT o."id",o."publicId",o."status",o."totalMinor",o."createdAt"
     FROM "Order" o
     WHERE NOT EXISTS (
       SELECT 1 FROM "PaymentAuthorization" pa
       WHERE pa."orderId"=o."id" AND pa."provider"='HYP'
     )
     ORDER BY o."createdAt" ASC`,
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const action = url.searchParams.get("action") || "plan";
  const candidates = await candidateIds();
  const ids = candidates.map((r) => r.id);
  const summary = {
    count: candidates.length,
    totalMinor: candidates.reduce((s, r) => s + Number(r.totalMinor || 0), 0),
    byStatus: Object.fromEntries([...new Set(candidates.map((r) => r.status))].map((status) => [status, candidates.filter((r) => r.status === status).length])),
    sample: candidates.slice(-20).map((r) => ({ publicId: r.publicId, status: r.status, totalMinor: r.totalMinor, createdAt: r.createdAt })),
  };
  if (action !== "execute") return NextResponse.json({ action: "plan", ...summary });
  if (!ids.length) return NextResponse.json({ action: "execute", deleted: 0, ...summary });

  await db.$transaction(async (tx) => {
    // Restore inventory counters from legacy paid orders before deleting their rows.
    await tx.$executeRawUnsafe(
      `WITH q AS (
         SELECT o."eventId", oi."categoryName", SUM(oi."quantity")::int AS qty
         FROM "OrderItem" oi JOIN "Order" o ON o."id"=oi."orderId"
         WHERE oi."orderId" = ANY($1::text[]) AND o."status"='PAID'
         GROUP BY o."eventId", oi."categoryName"
       )
       UPDATE "TicketCategory" c
       SET "sold"=GREATEST(0,c."sold"-q.qty)
       FROM q WHERE c."eventId"=q."eventId" AND c."name"=q."categoryName"`, ids);

    await tx.$executeRawUnsafe(
      `UPDATE "Table" t SET "reserved"=false
       WHERE t."id" IN (SELECT DISTINCT "tableId" FROM "OrderItem" WHERE "orderId" = ANY($1::text[]) AND "tableId" IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o."id"=oi."orderId"
         WHERE oi."tableId"=t."id" AND NOT (oi."orderId" = ANY($1::text[])) AND o."status"='PAID'
       )`, ids);
    await tx.$executeRawUnsafe(
      `UPDATE "Seat" s SET "status"='AVAILABLE'
       WHERE s."id" IN (SELECT DISTINCT "seatId" FROM "OrderItem" WHERE "orderId" = ANY($1::text[]) AND "seatId" IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o."id"=oi."orderId"
         WHERE oi."seatId"=s."id" AND NOT (oi."orderId" = ANY($1::text[])) AND o."status"='PAID'
       )`, ids);

    const ticketRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Ticket" WHERE "orderId" = ANY($1::text[])`, ids);
    const ticketIds = ticketRows.map((r) => r.id);
    if (ticketIds.length) {
      await tx.$executeRawUnsafe(`DELETE FROM "Scan" WHERE "ticketId" = ANY($1::text[])`, ticketIds);
      if (await tableExists("WalletRegistration")) await tx.$executeRawUnsafe(`DELETE FROM "WalletRegistration" WHERE "ticketId" = ANY($1::text[])`, ticketIds);
    }

    const reservationRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Reservation" WHERE "orderId" = ANY($1::text[])`, ids);
    const reservationIds = reservationRows.map((r) => r.id);
    if (reservationIds.length) {
      if (await tableExists("ReservationClaim")) await tx.$executeRawUnsafe(`DELETE FROM "ReservationClaim" WHERE "reservationId" = ANY($1::text[])`, reservationIds);
      await tx.$executeRawUnsafe(`DELETE FROM "ReservationItem" WHERE "reservationId" = ANY($1::text[])`, reservationIds);
      await tx.$executeRawUnsafe(`DELETE FROM "Reservation" WHERE "id" = ANY($1::text[])`, reservationIds);
    }

    if (await tableExists("AbandonedCheckout")) {
      const checkoutRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "AbandonedCheckout" WHERE "orderId" = ANY($1::text[])`, ids);
      const checkoutIds = checkoutRows.map((r) => r.id);
      if (checkoutIds.length && await tableExists("RecoveryAction")) await tx.$executeRawUnsafe(`DELETE FROM "RecoveryAction" WHERE "checkoutId" = ANY($1::text[])`, checkoutIds);
      await tx.$executeRawUnsafe(`DELETE FROM "AbandonedCheckout" WHERE "orderId" = ANY($1::text[])`, ids);
    }

    if (await tableExists("RequestDismissal")) await tx.$executeRawUnsafe(`DELETE FROM "RequestDismissal" WHERE "orderId" = ANY($1::text[])`, ids);
    if (await tableExists("NotificationDelivery")) await tx.$executeRawUnsafe(`DELETE FROM "NotificationDelivery" WHERE "orderId" = ANY($1::text[])`, ids);
    if (await tableExists("OrderCommercialSnapshot")) await tx.$executeRawUnsafe(`DELETE FROM "OrderCommercialSnapshot" WHERE "orderId" = ANY($1::text[])`, ids);
    if (await tableExists("CustomerDemographics")) await tx.$executeRawUnsafe(`DELETE FROM "CustomerDemographics" WHERE "orderId" = ANY($1::text[])`, ids);

    await tx.$executeRawUnsafe(`DELETE FROM "PaymentAuthorization" WHERE "orderId" = ANY($1::text[])`, ids);
    await tx.$executeRawUnsafe(`DELETE FROM "Ticket" WHERE "orderId" = ANY($1::text[])`, ids);
    await tx.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "orderId" = ANY($1::text[])`, ids);
    await tx.$executeRawUnsafe(`DELETE FROM "Order" WHERE "id" = ANY($1::text[])`, ids);
  }, { timeout: 120000 });

  const remaining = await candidateIds();
  return NextResponse.json({ action: "execute", deleted: ids.length, remainingNonHyp: remaining.length, ...summary });
}
