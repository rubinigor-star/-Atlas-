import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { eventDate } from "@/lib/format";
import { effectiveTicketPrice } from "@/lib/ticketing";
import { EventPurchase } from "@/components/event-purchase";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    include: {
      venue: true,
      categories: { include: { priceTiers: true } },
      zones: { include: { tables: { include: { category: { select: { name: true, colorHex: true } }, seatItems: { orderBy: { position: "asc" } } } } } },
    },
  });
  if (!event || event.status !== "PUBLISHED") notFound();
  const categories = event.categories.flatMap((category) => {
    if (category.hidden) return [];
    try { return [{ ...category, priceMinor: effectiveTicketPrice(category) }]; } catch { return []; }
  });
  const objects = event.mapEnabled ? event.zones.flatMap((zone) => zone.tables.map((table) => ({ ...table, zone: { name: zone.name } }))) : [];
  return <main className="shell event-hero">
    <Image src={event.posterUrl} width={1000} height={1250} alt={event.title} className="poster" priority />
    <section className="event-info"><span className="pill">{event.venue.city}</span><h1>{event.title}</h1>
      <div className="meta"><div className="meta-row"><CalendarDays size={22} /><div><strong>{eventDate(event.startsAt)}</strong><br /><span className="muted">Двери откроются за час до начала</span></div></div><div className="meta-row"><MapPin size={22} /><div><strong>{event.venue.name}</strong><br /><span className="muted">{event.venue.address}</span></div></div><div className="meta-row"><ShieldCheck size={22} /><div><strong>Безопасный тестовый checkout</strong><br /><span className="muted">В этой MVP-версии деньги не списываются</span></div></div></div>
      <p className="muted" style={{ lineHeight: 1.65 }}>{event.description}</p>
      {categories.length ? <EventPurchase eventId={event.id} categories={categories} objects={objects} /> : <div className="panel"><strong>Продажи сейчас закрыты</strong><p className="muted">Ни один тариф не доступен в текущий период.</p></div>}
    </section>
  </main>;
}
