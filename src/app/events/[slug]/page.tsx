import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { CalendarDays, Clock3, ExternalLink, Languages, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { eventDate, eventDay, eventStartTime, money } from "@/lib/format";
import { effectiveTicketPrice, ticketPricePresentation } from "@/lib/ticketing";
import { EventPurchase } from "@/components/event-purchase";
import { EventShareActions } from "@/components/event-share-actions";
import { EventHeroGallery } from "@/components/event-hero-gallery";
import { EventAboutCard } from "@/components/event-about-card";
import { parseEventMedia, stripEventMedia } from "@/lib/event-media";
import { parseEventPresentation, stripEventPresentation } from "@/lib/event-presentation";
import { stripEventRejectionMessage } from "@/lib/event-approval-message";
import { stripBuyerQuestions } from "@/lib/buyer-questions";
import { stripEventMarkers } from "@/lib/event-guest-fields";
import { parsePricingMarketingStrategy, stripPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { getServerI18n } from "@/lib/server-locale";
import { stripEventType } from "@/lib/event-type";
import { eventLanguageLabels } from "@/lib/event-language";
import { getEventLanguageSettings } from "@/lib/event-language-server";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import styles from "./event-detail.module.css";
import metaAlignment from "./event-meta-alignment.module.css";
import mobile from "./event-mobile.module.css";
import bodyLayout from "./event-body.module.css";
import desktopLayout from "./event-desktop.module.css";

export const dynamic = "force-dynamic";

const copy = {
  ru: {
    buyFrom: "Купить билеты от",
    buy: "Купить билеты",
    about: "О мероприятии",
    readMore: "Читать далее",
    readLess: "Свернуть",
    date: "Дата мероприятия",
    start: "Начало мероприятия",
    venue: "Площадка",
    language: "Язык мероприятия",
    secure: "Безопасная покупка",
    secureInfo: "Защищённая оплата и электронный билет",
  },
  he: {
    buyFrom: "רכישת כרטיסים החל מ־",
    buy: "רכישת כרטיסים",
    about: "אודות האירוע",
    readMore: "לקריאה נוספת",
    readLess: "צמצום",
    date: "תאריך האירוע",
    start: "תחילת האירוע",
    venue: "מקום האירוע",
    language: "שפת האירוע",
    secure: "רכישה מאובטחת",
    secureInfo: "תשלום מוגן וכרטיס דיגיטלי",
  },
  en: {
    buyFrom: "Get tickets from",
    buy: "Get tickets",
    about: "About the event",
    readMore: "Read more",
    readLess: "Show less",
    date: "Event date",
    start: "Event start",
    venue: "Venue",
    language: "Event language",
    secure: "Secure checkout",
    secureInfo: "Protected payment and digital ticket",
  },
} as const;

export default async function EventPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
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
  const [promoterLink, zones, languageSettings, commercialTerms] = await Promise.all([
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
    getEventLanguageSettings(event.id),
    getEffectiveEventTerms(event.id, event.organizationId),
  ]);

  const now = new Date();
  const validPromoterLink = promoterLink
    && promoterLink.eventId === event.id
    && promoterLink.active
    && (!promoterLink.startsAt || promoterLink.startsAt <= now)
    && (!promoterLink.endsAt || promoterLink.endsAt >= now)
    ? promoterLink
    : null;

  const categories = event.categories.flatMap((category) => {
    if (category.hidden) return [];
    try {
      const standardPrice = effectiveTicketPrice(category, now);
      const channelPrice = validPromoterLink?.allocationType === "CATEGORY"
        && validPromoterLink.categoryId === category.id
        && validPromoterLink.customPriceMinor !== null
        ? validPromoterLink.customPriceMinor
        : standardPrice;
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
  const presentation = parseEventPresentation(event.description);
  const heroVideo = media.find((item) => item.type === "VIDEO")?.url;
  const links = media.filter((item) => item.type === "LINK");
  const languageLabel = eventLanguageLabels[i18n.locale][languageSettings.primaryLanguage];
  const publicDescription = stripEventPresentation(
    stripEventType(
      stripEventMarkers(
        stripBuyerQuestions(
          stripEventRejectionMessage(
            stripEventMedia(event.description),
          ),
        ),
      ),
    ),
  ).trim();
  const shortDescription = presentation.shortDescription || publicDescription.replace(/\s+/g, " ").slice(0, 150);
  const text = i18n.messages.event;
  const local = copy[i18n.locale];
  const eventUrl = `https://www.atlas-one.co/events/${event.slug}`;
  const lowestPrice = categories.length ? Math.min(...categories.map((category) => category.priceMinor)) : null;
  const ctaLabel = lowestPrice === null ? local.buy : `${local.buyFrom} ${money(lowestPrice, "ILS", i18n.locale)}`;
  const locationLabel = /(?:israel|ישראל)/i.test(event.venue.city) ? event.venue.city : `${event.venue.city}, Israel`;
  const pageStyle = { "--event-hero-image": `url("${event.posterUrl}")` } as CSSProperties;
  const feeTerms = {
    salesFeePercentBps: commercialTerms.organizer.salesFeePercentBps,
    salesFeeFixedMinor: commercialTerms.organizer.salesFeeFixedMinor,
    serviceFeePayer: commercialTerms.serviceFeePayer,
  };

  return <main className={styles.page} style={pageStyle}>
    <section className={`${styles.hero} ${mobile.hero} ${desktopLayout.hero}`}>
      <div className={`shell ${styles.heroGrid} ${mobile.heroGrid} ${desktopLayout.wideShell} ${desktopLayout.heroGrid}`}>
        <div className={`${styles.heroCopy} ${mobile.heroCopy}`}>
          <div className={styles.location}><MapPin size={17}/><span>{locationLabel}</span></div>
          <h1 className={styles.title}>{event.title}</h1>
          {shortDescription && <p className={styles.summary}>{shortDescription}</p>}
          <div className={styles.heroActions}>
            <a className={styles.buyButton} href="#tickets">{ctaLabel}</a>
            <div className={styles.shareWrap}><EventShareActions title={event.title} url={eventUrl}/></div>
          </div>
        </div>

        <EventHeroGallery
          title={event.title}
          posterUrl={event.posterUrl}
          videoUrl={heroVideo}
          galleryUrls={presentation.galleryEnabled ? presentation.galleryUrls : []}
        />
      </div>

      <div className={`${metaAlignment.shell} ${desktopLayout.wideShell}`}>
        <div className={`${styles.metaStrip} ${metaAlignment.strip} ${mobile.metaStrip}`}>
          <div className={`${styles.metaItem} ${mobile.metaItem}`}><CalendarDays size={19}/><span>{eventDate(event.startsAt, i18n.locale)}</span></div>
          <div className={`${styles.metaItem} ${mobile.metaItem}`}><MapPin size={19}/><span>{event.venue.name}</span></div>
          <div className={`${styles.metaItem} ${mobile.metaItem}`}><Languages size={19}/><span>{languageLabel}</span></div>
          <div className={`${styles.metaItem} ${mobile.metaItem}`}><ShieldCheck size={19}/><span>{local.secure}</span></div>
        </div>
      </div>
    </section>

    <section className={`${styles.body} ${bodyLayout.body}`}>
      <div className={`shell ${styles.bodyGrid} ${bodyLayout.shell} ${bodyLayout.grid} ${desktopLayout.wideShell} ${desktopLayout.bodyGrid}`}>
        <article className={`${styles.contentCard} ${bodyLayout.content}`}>
          {publicDescription
            ? <EventAboutCard
                heading={local.about}
                title={event.title}
                description={publicDescription}
                posterUrl={event.posterUrl}
                readMore={local.readMore}
                readLess={local.readLess}
              />
            : <h2>{local.about}</h2>}

          <div className={styles.detailsList}>
            <div className={styles.detailItem}><CalendarDays size={21}/><div><strong>{local.date}</strong><span>{eventDay(event.startsAt, i18n.locale)}</span></div></div>
            <div className={styles.detailItem}><Clock3 size={21}/><div><strong>{local.start}</strong><span>{eventStartTime(event.startsAt, i18n.locale)}</span></div></div>
            <div className={styles.detailItem}><MapPin size={21}/><div><strong>{local.venue}</strong><span>{event.venue.name}<br/>{event.venue.address}</span></div></div>
            <div className={styles.detailItem}><Languages size={21}/><div><strong>{local.language}</strong><span>{languageLabel}</span></div></div>
            <div className={`${styles.detailItem} ${styles.detailWide}`}><ShieldCheck size={21}/><div><strong>{local.secure}</strong><span>{local.secureInfo}</span></div></div>
          </div>

          {links.length > 0 && <div className={styles.links}>
            {links.map((item, index) => <a key={`${item.url}-${index}`} className={styles.externalLink} href={item.url} target="_blank" rel="noreferrer">
              <span>{item.title || new URL(item.url).hostname}</span><ExternalLink size={15}/>
            </a>)}
          </div>}
        </article>

        <aside id="tickets" className={styles.ticketsColumn}>
          {validPromoterLink && <div className={styles.promoterCard}><strong>{text.personalLink}: {validPromoterLink.label}</strong><p>{text.personalLinkInfo}</p></div>}
          {categories.length
            ? <div className={styles.ticketCard}><EventPurchase eventId={event.id} categories={categories} objects={objects} feeTerms={feeTerms} referralCode={validPromoterLink?.code} allocation={validPromoterLink ? { type: validPromoterLink.allocationType, categoryId: validPromoterLink.categoryId, tableId: validPromoterLink.tableId, customPriceMinor: validPromoterLink.customPriceMinor } : undefined}/></div>
            : <div className={styles.closedCard}><strong>{text.salesClosed}</strong><p>{text.noTariffs}</p></div>}
        </aside>
      </div>
    </section>
  </main>;
}
