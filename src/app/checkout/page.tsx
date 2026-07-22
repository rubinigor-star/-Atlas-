import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CheckoutForm } from "@/components/checkout-form";

export const dynamic = "force-dynamic";

export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const quantity = Math.max(1, Math.min(10, Number(query.quantity) || 1));
  const seatIds = query.seatIds?.split(",").filter(Boolean).slice(0, 10) ?? [];
  const [event, category, table, seats] = await Promise.all([
    db.event.findUnique({ where: { id: query.eventId } }),
    db.ticketCategory.findUnique({ where: { id: query.categoryId } }),
    query.tableId ? db.table.findUnique({ where: { id: query.tableId } }) : null,
    seatIds.length ? db.seat.findMany({ where: { id: { in: seatIds } }, include: { table: true } }) : [],
  ]);
  if (!event || !category || category.eventId !== event.id) notFound();
  if (seatIds.length && (seats.length !== seatIds.length || seats.some((seat) => seat.table.categoryId !== category.id))) notFound();
  const seatObject = seats[0]?.table;
  const total = table?.priceMinor ?? (seatObject ? seatObject.priceMinor * seats.length : category.priceMinor * quantity);

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
      />
    </main>
  );
}
