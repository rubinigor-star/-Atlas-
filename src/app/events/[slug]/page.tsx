import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { eventDate } from "@/lib/format";
import { effectiveTicketPrice, ticketPricePresentation } from "@/lib/ticketing";
import { EventPurchase } from "@/components/event-purchase";
import { parseEventMedia, stripEventMedia, videoEmbedUrl } from "@/lib/event-media";
import { stripEventRejectionMessage } from "@/lib/event-approval-message";
import { parsePricingMarketingStrategy, stripPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { getServerI18n } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

export default async function EventPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ slug }, query, i18n] = await Promise.all([params, searchParams, getServerI18n()]);
  const event = await db.event.findUnique({
    where: { slug },
    include: {
      venue: true,
      categories: { include: { priceTiers: true } },
    },
  });
  if (!event || event.status !== "PUBLISHED") notFound();

  const channelCode = query.ref || query.channel;
  const [promoterLink, zones] = await Promise.all([
    channelCode ? db.promoterLink.findUnique({ where: { code: channelCode.toUpperCase() } }) : Promise.resolve(null),
    event.mapEnabled
      ? db.zone.findMany({
          where: { eventId: event.id },
          select: {
            name: true,
            tables: {
              include: {
                category: { select: { name: true, colorHex: true } },
                seatItems: { orderBy: { position: "asc" } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();
  const validPromoterLink = promoterLink && promoterLink.eventId === event.id && promoterLink.active && (!promoterLink.startsAt || promoterLink.startsAt <= now) && (!promoterLink.endsAt || promoterLink.endsAt >= now) ? promoterLink : null;
  const categories = event.categories.flatMap((category) => {
    if (category.hidden) return [];
    try {
      const standardPrice = effectiveTicketPrice(category, now);
      const channelPrice = validPromoterLink?.allocationType === "CATEGORY" && validPromoterLink.categoryId === category.id && validPromoterLink.customPriceMinor !== null ? validPromoterLink.customPriceMinor : standardPrice;
      return [{
        ...category,
        description: stripPricingMarketingStrategy(category.description),
        priceMinor: channelPrice,
        pricingPresentation: ticketPricePresentation(category, now),
        marketingStrategy: parsePricingMarketingStrategy(category.description),
      }];
    } catch {
      return [];
    }
  });
  const objects = zones.flatMap((zone) => zone.tables.map((table) => ({ ...table, zone: { name: zone.name } })));
  const media = parseEventMedia(event.description);
  const videos = media.filter((item) => item.type === "VIDEO");
  const links = media.filter((item) => item.type === "LINK");
  const publicDescription = stripEventRejectionMessage(stripEventMedia(event.description));
  const text = i18n.messages.event;

  return <main className="shell event-hero">
    <Image src={event.posterUrl} width={1000} height={1250} alt={event.title} className="poster" priority sizes="(max-width: 900px) 100vw, 45vw" />
    <section className="event-info"><span className="pill">{event.venue.city}</span><h1>{event.title}</h1>
      {validPromoterLink && <div className="panel"><strong>{text.personalLink}: {validPromoterLink.label}</strong><p className="muted">{text.personalLinkInfo}</p></div>}
      <div className="meta"><div className="meta-row"><CalendarDays size={22} /><div><strong>{eventDate(event.startsAt,i18n.locale)}</strong><br /><span className="muted">{text.doors}</span></div></div><div className="meta-row"><MapPin size={22} /><div><strong>{event.venue.name}</strong><br /><span className="muted">{event.venue.address}</span></div></div><div className="meta-row"><ShieldCheck size={22} /><div><strong>{text.safeCheckout}</strong><br /><span className="muted">{text.safeCheckoutInfo}</span></div></div></div>
      <p className="muted" style={{ lineHeight: 1.65 }}>{publicDescription}</p>
      {videos.length > 0 && <section style={{ display: "grid", gap: 16, margin: "24px 0" }}><h2 style={{ marginBottom: 0 }}>{text.videos}</h2>{videos.map((item, index) => { const embed = videoEmbedUrl(item.url); return embed ? <div key={`${item.url}-${index}`} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", borderRadius: 16, background: "#081426" }}><iframe loading="lazy" src={embed} title={item.title || `${text.videos} ${index + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div> : <a key={`${item.url}-${index}`} className="btn secondary" href={item.url} target="_blank" rel="noreferrer">{text.openVideo} <ExternalLink size={16} /></a>; })}</section>}
      {links.length > 0 && <section className="panel" style={{ margin: "20px 0" }}><h2 style={{ marginTop: 0 }}>{text.links}</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{links.map((item, index) => <a key={`${item.url}-${index}`} className="btn secondary" href={item.url} target="_blank" rel="noreferrer">{item.title || new URL(item.url).hostname} <ExternalLink size={16} /></a>)}</div></section>}
      {categories.length ? <EventPurchase eventId={event.id} categories={categories} objects={objects} referralCode={validPromoterLink?.code} allocation={validPromoterLink ? { type: validPromoterLink.allocationType, categoryId: validPromoterLink.categoryId, tableId: validPromoterLink.tableId, customPriceMinor: validPromoterLink.customPriceMinor } : undefined} /> : <div className="panel"><strong>{text.salesClosed}</strong><p className="muted">{text.noTariffs}</p></div>}
    </section>
  </main>;
}
