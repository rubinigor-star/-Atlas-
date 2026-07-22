import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { EventManager } from "@/components/event-manager";
import { VenueMapEditor } from "@/components/venue-map-editor";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ManageEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, include: { categories: true, zones: { include: { tables: { include: { seatItems: true } } } } } });
  if (!event) notFound();
  return (
    <AdminShell>
      <span className="eyebrow">Event manager</span>
      <h1>{event.title}</h1>
      <div className="stats">
        <div className="stat"><span className="muted">Статус</span><strong>{event.status}</strong></div>
        <div className="stat"><span className="muted">Продажа</span><strong>{event.salesMode === "INSTANT" ? "Автоматически" : "По одобрению"}</strong></div>
        <div className="stat"><span className="muted">VIP-столов</span><strong>{event.zones.reduce((sum, zone) => sum + zone.tables.length, 0)}</strong></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Категория</th><th>Цена</th><th>Продано</th><th>Остаток</th></tr></thead><tbody>{event.categories.map((item) => <tr key={item.id}><td>{item.name}</td><td>{money(item.priceMinor)}</td><td>{item.sold}</td><td>{item.capacity - item.sold}</td></tr>)}</tbody></table></div>
      <h2>Настройки</h2>
      <EventManager event={{ id: event.id, title: event.title, description: event.description, status: event.status, startsAt: event.startsAt.toISOString(), salesMode: event.salesMode, approvalInstructions: event.approvalInstructions }} />
      <h2 className="section-title">Карта мероприятия</h2>
      <VenueMapEditor
        eventId={event.id}
        categories={event.categories.map((category) => ({ id: category.id, name: category.name, priceMinor: category.priceMinor }))}
        initialObjects={event.zones.flatMap((zone) => zone.tables.map((item) => ({
          id: item.id,
          label: item.label,
          objectType: item.objectType,
          seats: item.seats,
          priceMode: item.priceMode,
          priceMinor: item.priceMinor,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          categoryId: item.categoryId ?? event.categories[0]?.id ?? "",
          reserved: item.reserved || item.seatItems.some((seat) => seat.status !== "AVAILABLE"),
        })))}
      />
    </AdminShell>
  );
}
