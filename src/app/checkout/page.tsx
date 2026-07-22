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
  const [event, category, table] = await Promise.all([
    db.event.findUnique({ where: { id: query.eventId } }),
    db.ticketCategory.findUnique({ where: { id: query.categoryId } }),
    query.tableId ? db.table.findUnique({ where: { id: query.tableId } }) : null,
  ]);
  if (!event || !category || category.eventId !== event.id) notFound();
  const total = table?.priceMinor ?? category.priceMinor * quantity;

  return (
    <main className="shell">
      <CheckoutForm
        eventId={event.id}
        categoryId={category.id}
        quantity={quantity}
        tableId={table?.id}
        total={total}
        title={event.title}
        label={table ? `VIP-стол ${table.label}, ${table.seats} мест` : category.name}
        salesMode={event.salesMode}
        approvalInstructions={event.approvalInstructions}
      />
    </main>
  );
}
