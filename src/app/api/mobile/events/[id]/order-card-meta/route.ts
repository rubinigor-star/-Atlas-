import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { getOrderDemographicsForOrders } from "@/lib/customer-demographics";

function canAccessEvent(
  user: NonNullable<Awaited<ReturnType<typeof getMobileStaff>>>,
  event: { id: string; organizationId: string },
) {
  if (user.role === "ADMIN") return true;
  if (!user.organizationId || user.organizationId !== event.organizationId) return false;
  const hasExplicitScope = user.eventAccess.length > 0;
  return !hasExplicitScope || user.eventAccess.some((access) => access.eventId === event.id);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("ORDER_VIEW") && user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });
  if (!event || !canAccessEvent(user, event)) {
    return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
  }

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (!ids.length) return NextResponse.json({ orders: {} });

  const orders = await db.order.findMany({
    where: { eventId: id, id: { in: ids } },
    select: {
      id: true,
      customerBirthDate: true,
      promoterLink: {
        select: {
          label: true,
          code: true,
          promoter: { select: { name: true } },
        },
      },
      referral: { select: { label: true, code: true } },
    },
  });

  const demographics = await getOrderDemographicsForOrders(orders.map((order) => order.id));
  const result = Object.fromEntries(orders.map((order) => {
    const attribution = order.promoterLink
      ? {
          kind: "PROMOTER" as const,
          label: `Промоутер · ${order.promoterLink.promoter.name}`,
          detail: order.promoterLink.label || order.promoterLink.code,
        }
      : order.referral
        ? {
            kind: "REFERRAL" as const,
            label: order.referral.label || "Referral",
            detail: order.referral.code,
          }
        : {
            kind: "DIRECT" as const,
            label: "Прямая ссылка Atlas",
            detail: null,
          };

    const demographic = demographics.get(order.id);
    return [order.id, {
      customerBirthDate: order.customerBirthDate?.toISOString() ?? demographic?.birthDate?.toISOString() ?? null,
      customerGender: demographic?.gender ?? null,
      attribution,
    }];
  }));

  return NextResponse.json({ orders: result });
}
