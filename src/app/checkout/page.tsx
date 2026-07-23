import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CheckoutForm } from "@/components/checkout-form";
import { effectiveTicketPrice } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const quantity = Math.max(1, Math.min(10, Number(query.quantity) || 1));
  const seatIds = query.seatIds?.split(",").filter(Boolean).slice(0, 10) ?? [];
  const [event, category, table, seats, promoterLink] = await Promise.all([
    db.event.findUnique({ where: { id: query.eventId } }),
    db.ticketCategory.findUnique({ where: { id: query.categoryId } }),
    query.tableId ? db.table.findUnique({ where: { id: query.tableId }, include: { category: { include: { priceTiers: true } }, zone: true } }) : null,
    seatIds.length ? db.seat.findMany({ where: { id: { in: seatIds } }, include: { category: { include: { priceTiers: true } }, table: { include: { zone: true } } } }) : [],
    query.ref ? db.promoterLink.findUnique({ where: { code: query.ref.toUpperCase() }, include: { promoter: true } }) : null,
  ]);
  if (!event || !category || category.eventId !== event.id) notFound();
  if (seatIds.length && (seats.length !== seatIds.length || seats.some((seat) => seat.table.zone.eventId !== event.id || !seat.category))) notFound();
  const validLink = promoterLink && promoterLink.eventId === event.id && promoterLink.active && (!promoterLink.startsAt || promoterLink.startsAt <= new Date()) && (!promoterLink.endsAt || promoterLink.endsAt >= new Date()) ? promoterLink : null;
  if (query.ref && !validLink) notFound();
  if (validLink?.allocationType === "TABLE" && table?.id !== validLink.tableId) notFound();
  if (validLink?.allocationType === "CATEGORY" && category.id !== validLink.categoryId) notFound();
  const seatObject = seats[0]?.table;
  const regularTotal = table?.category ? effectiveTicketPrice(table.category) : seats.length ? seats.reduce((sum, seat) => sum + effectiveTicketPrice(seat.category!), 0) : category.priceMinor * quantity;
  const total = validLink?.customPriceMinor ? (validLink.allocationType === "TABLE" ? validLink.customPriceMinor : validLink.customPriceMinor * quantity) : regularTotal;

  return (
    <main className="shell">
      <CheckoutForm
        eventId={event.id}
        categoryId={category.id}
        quantity={quantity}
        tableId={table?.id}
        seatIds={seatIds}
        total={total}
        title={event.title}
        label={table ? `${table.objectType === "SOFA" ? "Диван" : "Стол"} ${table.label}, ${table.seats} мест целиком` : seatObject ? `${seatObject.objectType === "SOFA" ? "Диван" : "Стол"} ${seatObject.label}, места ${seats.map((seat) => seat.position).join(", ")}` : category.name}
        salesMode={event.salesMode}
        approvalInstructions={event.approvalInstructions}
        referralCode={validLink?.code}
        promoterLabel={validLink ? `${validLink.promoter.name} · ${validLink.label}` : undefined}
      />
    </main>
  );
}
