import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GuestListPage } from "@/components/guest-list-page";
import { isGuestListPromoter, verifyGuestManagementToken } from "@/lib/guest-links";

export const dynamic = "force-dynamic";

export default async function GuestPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const link = await db.promoterLink.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      promoter: true,
      event: true,
      category: true,
      table: true,
      orders: {
        where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
        orderBy: { createdAt: "asc" },
        include: { tickets: true },
      },
    },
  });
  if (!link || !link.active || !isGuestListPromoter(link.promoter.name)) notFound();
  const token = query.token || "";
  const canManage = verifyGuestManagementToken(link.id, token);
  const limit = link.guestLimit ?? link.table?.seats ?? link.category?.capacity ?? 0;
  const allocation = link.table ? `Стол ${link.table.label}` : link.category ? `Билет: ${link.category.name}` : "Гостевой список";
  return <GuestListPage
    code={link.code}
    token={token}
    title={link.label}
    eventTitle={link.event.title}
    allocation={allocation}
    limit={limit}
    canManage={canManage}
    guests={link.orders.map((order) => ({ id: order.id, name: order.customerName, phone: order.customerPhone, ticketStatus: order.tickets[0]?.status ?? "VALID" }))}
  />;
}
