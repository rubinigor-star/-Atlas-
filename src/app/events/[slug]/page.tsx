import Image from "next/image";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { CalendarDays, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { eventDate } from "@/lib/format";
import { effectiveTicketPrice, ticketPricePresentation } from "@/lib/ticketing";
import { EventPurchase } from "@/components/event-purchase";
import { EventShareActions } from "@/components/event-share-actions";
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
  const eventUrl = `https://www.atlas-one.co/events/${event.slug}`;
  const stageStyle = { "--event-backdrop": `url("${event.posterUrl}")` } as CSSProperties;

  return <main className="event-stage" style={stageStyle}>
    <div className="shell event-experience">
      <aside className="event-media-rail">
        <Image src={event.posterUrl} width={750} height={750} alt={event.title} className="event-square-poster" priority sizes="(max-width: 800px) 100vw, 390px" />
        {videos.map((item, index) => { const embed = videoEmbedUrl(item.url); return embed ? <div className="event-media-card" key={`${item.url}-${index}`}><iframe loading="lazy" src={embed} title={item.title || `${text.videos} ${index + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <a key={`${item.url}-${index}`} className="event-media-card event-media-link" href={item.url} target="_blank" rel="noreferrer"><span>{item.title || text.openVideo}</span><ExternalLink size={17}/></a>; })}
        {links.map((item, index) => <a key={`${item.url}-${index}`} className="event-media-card event-media-link" href={item.url} target="_blank" rel="noreferrer"><span>{item.title || new URL(item.url).hostname}</span><ExternalLink size={17}/></a>)}
      </aside>

      <section className="event-content-panel event-info">
        <div className="event-title-row"><div><span className="pill">{event.venue.city}</span><h1>{event.title}</h1></div><EventShareActions title={event.title} url={eventUrl}/></div>
        {validPromoterLink && <div className="panel"><strong>{text.personalLink}: {validPromoterLink.label}</strong><p className="muted">{text.personalLinkInfo}</p></div>}
        <div className="meta"><div className="meta-row"><CalendarDays size={22} /><div><strong>{eventDate(event.startsAt,i18n.locale)}</strong><br /><span className="muted">{text.doors}</span></div></div><div className="meta-row"><MapPin size={22} /><div><strong>{event.venue.name}</strong><br /><span className="muted">{event.venue.address}</span></div></div><div className="meta-row"><ShieldCheck size={22} /><div><strong>{text.safeCheckout}</strong><br /><span className="muted">{text.safeCheckoutInfo}</span></div></div></div>
        <section><h2>About</h2><p className="muted" style={{ lineHeight: 1.75 }}>{publicDescription}</p></section>
        {categories.length ? <EventPurchase eventId={event.id} categories={categories} objects={objects} referralCode={validPromoterLink?.code} allocation={validPromoterLink ? { type: validPromoterLink.allocationType, categoryId: validPromoterLink.categoryId, tableId: validPromoterLink.tableId, customPriceMinor: validPromoterLink.customPriceMinor } : undefined} /> : <div className="panel"><strong>{text.salesClosed}</strong><p className="muted">{text.noTariffs}</p></div>}
      </section>
    </div>
  </main>;
}
