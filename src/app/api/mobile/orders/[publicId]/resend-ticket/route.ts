import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { sendOrderTicketSms } from "@/lib/order-sms";

const schema = z.object({ channel: z.enum(["email", "sms"]).default("email") });

function canAccessEvent(
  user: NonNullable<Awaited<ReturnType<typeof getMobileStaff>>>,
  eventId: string,
  organizationId: string,
) {
  if (user.role === "ADMIN") return true;
  if (!user.organizationId || user.organizationId !== organizationId) return false;
  const hasExplicitScope = user.eventAccess.length > 0;
  return !hasExplicitScope || user.eventAccess.some((access) => access.eventId === eventId);
}

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.role !== "ADMIN" && !user.permissionSet.has("ORDER_MANAGE")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { publicId } = await params;
  try {
    const input = schema.parse(await request.json().catch(() => ({})));
    const order = await db.order.findUnique({
      where: { publicId },
      select: {
        status: true,
        eventId: true,
        event: { select: { organizationId: true } },
      },
    });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    if (!canAccessEvent(user, order.eventId, order.event.organizationId)) {
      return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
    }
    if (order.status !== "PAID") {
      return NextResponse.json({ error: "Билет можно отправить только по оплаченному заказу" }, { status: 409 });
    }

    if (input.channel === "sms") {
      const result = await sendOrderTicketSms(publicId);
      return NextResponse.json({
        sent: true,
        channel: "sms",
        recipient: result.recipient,
        priceMinor: result.priceMinor,
        providerStatus: result.providerStatus,
      });
    }

    const result = await sendOrderTicketEmail(publicId);
    return NextResponse.json({
      sent: true,
      channel: "email",
      recipient: result.recipient,
      id: result.id,
      priceMinor: 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить билет" },
      { status: 400 },
    );
  }
}
