import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";

type CurrentAuthorization = { id: string; cgUid: string | null; tranId: string | null };
type LegacyAuthorization = {
  id: string;
  provider: string;
  providerReference: string;
  status: string;
  amountMinor: number;
  currency: string;
  cardLast4: string | null;
  capturedAt: Date | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const order = await db.order.findUnique({ where: { publicId: id } });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    await requireEventAccess("ORDER_MANAGE", order.eventId);
    if (order.status !== "PAID") return NextResponse.json({ error: "Заказ не оплачен" }, { status: 409 });

    const current = (await db.$queryRawUnsafe<CurrentAuthorization[]>(
      `SELECT "id","cgUid","tranId" FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,
      order.id,
    ).catch(() => []))[0];
    if (current) return NextResponse.json({ ok: true, recovered: false, current });

    const legacy = (await db.$queryRawUnsafe<LegacyAuthorization[]>(
      `SELECT id,provider,providerreference AS "providerReference",status,amountminor AS "amountMinor",currency,cardlast4 AS "cardLast4",capturedat AS "capturedAt" FROM paymentauthorization WHERE orderid=$1 LIMIT 1`,
      order.id,
    ).catch(() => []))[0];

    if (!legacy || legacy.provider !== "HYP" || legacy.status !== "CAPTURED" || !legacy.providerReference) {
      return NextResponse.json({ error: "Подтверждённая старая транзакция HYP не найдена" }, { status: 409 });
    }
    if (legacy.amountMinor !== order.totalMinor) {
      return NextResponse.json({ error: "Сумма старой транзакции не совпадает с заказом" }, { status: 409 });
    }

    const authorizationId = `auth_${randomUUID().replace(/-/g, "")}`;
    await db.$executeRawUnsafe(
      `INSERT INTO "PaymentAuthorization" ("id","orderId","provider","providerReference","cgUid","tranId","txId","method","status","amountMinor","refundedMinor","currency","cardLast4","authorizedAt","capturedAt","expiresAt","createdAt","updatedAt") VALUES ($1,$2,'HYP',$3,$3,NULL,NULL,'HOSTED_PAGE','CAPTURED',$4,0,$5,$6,COALESCE($7,CURRENT_TIMESTAMP),COALESCE($7,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP + INTERVAL '10 years',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("orderId") DO NOTHING`,
      authorizationId,
      order.id,
      legacy.providerReference,
      legacy.amountMinor,
      legacy.currency,
      legacy.cardLast4,
      legacy.capturedAt,
    );

    console.info("hyp.authorization.recovered", {
      publicId: order.publicId,
      cgUid: legacy.providerReference,
      amountMinor: legacy.amountMinor,
    });

    return NextResponse.json({ ok: true, recovered: true, cgUid: legacy.providerReference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось восстановить транзакцию";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
