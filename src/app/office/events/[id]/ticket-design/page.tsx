import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { parseTicketDesign } from "@/lib/ticket-template";
import { AdminShell } from "@/components/admin-shell";
import { TicketDesigner } from "@/components/ticket-designer";
import { TicketPresetPicker } from "@/components/ticket-preset-picker";

export const dynamic = "force-dynamic";

export default async function TicketDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireEventAccess("TICKET_MANAGE", id);
  const event = await db.event.findUnique({
    where: { id },
    include: {
      venue: true,
      ticketTemplate: true,
      categories: { select: { name: true } },
    },
  });
  if (!event) notFound();

  const design = parseTicketDesign(event.ticketTemplate);
  const eventData = {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    venue: event.venue.name,
    address: event.venue.address,
    ticketType: event.categories[0]?.name ?? "General Admission",
  };
  const designVersion = event.ticketTemplate?.updatedAt.toISOString() ?? "default-ticket-design";

  return (
    <AdminShell>
      <TicketPresetPicker event={eventData} initialDesign={design} />
      <div className="panel" style={{ marginBottom: 22, padding: "14px 18px", borderLeft: `4px solid ${design.accentColor}` }}>
        <strong>Важно:</strong> блок выше является живым предпросмотром. Реальные PDF и Apple Wallet открываются из оплаченного заказа после сохранения выбранного языка и шаблона.
      </div>
      <TicketDesigner key={designVersion} event={eventData} initialDesign={design} />
    </AdminShell>
  );
}
