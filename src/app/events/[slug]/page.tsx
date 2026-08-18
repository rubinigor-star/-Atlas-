import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { eventDay, eventStartTime, money } from "@/lib/format";
import { effectiveTicketPrice, ticketPricePresentation } from "@/lib/ticketing";
import { GeneralAdmissionPurchase } from "@/components/general-admission-purchase";
import { SeatMapPurchaseCard } from "@/components/seat-map-purchase-card";
import { EventShareActions } from "@/components/event-share-actions";
import { EventHeroGallery } from "@/components/event-hero-gallery";
import { EventHeroPalette } from "@/components/event-hero-palette";
import { EventMobileVideo } from "@/components/event-mobile-video";
import { EventMobileStickyCta } from "@/components/event-mobile-sticky-cta";
import { LiveViewerPressure } from "@/components/live-viewer-pressure";
import { EventAboutCard } from "@/components/event-about-card";
import { EventFaq } from "@/components/event-faq";
import { EventMetaStrip } from "@/components/event-meta-strip";
import { EventFactsGrid } from "@/components/event-facts-grid";
import { PromoterLinkTracker } from "@/components/promoter-link-tracker";
import { parseEventMedia, stripEventMedia } from "@/lib/event-media";
import { parseEventPresentation, stripEventPresentation } from "@/lib/event-presentation";
import { stripEventRejectionMessage } from "@/lib/event-approval-message";
import { stripBuyerQuestions } from "@/lib/buyer-questions";
import { stripEventMarkers } from "@/lib/event-guest-fields";
import { parsePricingMarketingStrategy, stripPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { parseTicketSalesStrategy, stripTicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import { getServerI18n } from "@/lib/server-locale";
import { eventTypeLabels, parseEventTypes, stripEventType } from "@/lib/event-type";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";
import styles from "./event-detail.module.css";
import metaAlignment from "./event-meta-alignment.module.css";
import mobile from "./event-mobile.module.css";
import bodyLayout from "./event-body.module.css";
import desktopLayout from "./event-desktop.module.css";
import palette from "./event-hero-palette.module.css";
import ctaLayout from "./event-cta-layout.module.css";

export const dynamic="force-dynamic";
const copy={
 ru:{buyFrom:"Купить билеты от",buy:"Купить билеты",from:"От",pick:"Выбрать места",about:"О мероприятии",faq:"Часто задаваемые вопросы",readMore:"Читать далее",readLess:"Свернуть"},
 he:{buyFrom:"רכישת כרטיסים החל מ־",buy:"רכישת כרטיסים",from:"החל מ־",pick:"בחירת מקומות",about:"אודות האירוע",faq:"שאלות נפוצות",readMore:"לקריאה נוספת",readLess:"צמצום"},
 en:{buyFrom:"Get tickets from",buy:"Get tickets",from:"From",pick:"Pick your seats",about:"About the event",faq:"Frequently asked questions",readMore:"Read more",readLess:"Show less"},
} as const;

export default async function EventPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const[{slug},query,i18n]=await Promise.all([params,searchParams,getServerI18n()]);
 const event=await db.event.findUnique({where:{slug},include:{venue:true,categories:{include:{priceTiers:true}}}}); if(!event||event.status!=="PUBLISHED")notFound();
 const channelCode=query.ref||query.channel;
 const[promoterLink,zones,commercialTerms]=await Promise.all([
  channelCode?db.promoterLink.findUnique({where:{code:channelCode.toUpperCase()}}):Promise.resolve(null),
  event.mapEnabled?db.zone.findMany({where:{eventId:event.id},select:{name:true,tables:{include:{category:{select:{name:true,colorHex:true}},seatItems:{orderBy:{position:"asc"}}}}}}):Promise.resolve([]),
  getEffectiveEventTerms(event.id,event.organizationId),
 ]);
 const now=new Date();
 const validPromoterLink=promoterLink&&promoterLink.eventId===event.id&&promoterLink.active&&(!promoterLink.startsAt||promoterLink.startsAt<=now)&&(!promoterLink.endsAt||promoterLink.endsAt>=now)?promoterLink:null;
 const categories=event.categories.flatMap(category=>{if(category.hidden)return[];try{const standardPrice=effectiveTicketPrice(category,now);const channelPrice=validPromoterLink?.allocationType==="CATEGORY"&&validPromoterLink.categoryId===category.id&&validPromoterLink.customPriceMinor!==null?validPromoterLink.customPriceMinor:standardPrice;return[{...category,description:stripTicketSalesStrategy(stripPricingMarketingStrategy(category.description)),priceMinor:channelPrice,pricingPresentation:ticketPricePresentation(category,now),marketingStrategy:parsePricingMarketingStrategy(category.description),salesStrategy:parseTicketSalesStrategy(category.description)}]}catch{return[]}});
 const objects=zones.flatMap(zone=>zone.tables.map(table=>({...table,zone:{name:zone.name}})));
 const media=parseEventMedia(event.description); const presentation=parseEventPresentation(event.description); const eventTypes=parseEventTypes(event.description); const publicCategoryLabels=eventTypes.map(type=>eventTypeLabels[i18n.locale][type]); const heroVideo=media.find(item=>item.type==="VIDEO")?.url; const links=media.filter(item=>item.type==="LINK");
 const publicDescription=stripEventPresentation(stripEventType(stripEventMarkers(stripBuyerQuestions(stripEventRejectionMessage(stripEventMedia(event.description)))))).trim();
 const shortDescription=presentation.shortDescription||publicDescription.replace(/\s+/g," ").slice(0,100);
 const text=i18n.messages.event; const local=copy[i18n.locale]; const eventUrl=`https://www.atlas-one.co/events/${event.slug}`;
 const feeTerms={salesFeePercentBps:commercialTerms.organizer.salesFeePercentBps,salesFeeFixedMinor:commercialTerms.organizer.salesFeeFixedMinor,serviceFeePayer:commercialTerms.serviceFeePayer};
 const buyerPrices=categories.map(category=>calculateServiceFee(category.priceMinor,feeTerms).buyerTotalMinor);
 const positivePrices=buyerPrices.filter(price=>price>0);
 const lowestPrice=positivePrices.length?Math.min(...positivePrices):(buyerPrices.length?Math.min(...buyerPrices):null);
 const ctaLabel=lowestPrice===null?local.buy:`${local.buyFrom} ${money(lowestPrice,"ILS",i18n.locale)}`;
 const mobilePriceLabel=lowestPrice===null?local.buy:`${local.from} ${money(lowestPrice,"ILS",i18n.locale)}`;
 const locationLabel=/(?:israel|ישראל)/i.test(event.venue.city)?event.venue.city:`${event.venue.city}, Israel`;
 const pageStyle={"--event-hero-image":`url("${event.posterUrl}")`} as CSSProperties;
 const seatHref=event.mapEnabled?`/events/${event.slug}/seats?qty=2${validPromoterLink?.code?`&ref=${encodeURIComponent(validPromoterLink.code)}`:""}`:undefined;
 return <main id="event-public-page" className={styles.page} style={pageStyle}>
  {validPromoterLink&&<PromoterLinkTracker code={validPromoterLink.code} eventId={event.id}/>} 
  <EventHeroPalette posterUrl={event.posterUrl} targetId="event-public-page"/>
  <section className={`${styles.hero} ${mobile.hero} ${desktopLayout.hero} ${palette.heroPalette}`}>
   <div className={`shell ${styles.heroGrid} ${mobile.heroGrid} ${desktopLayout.wideShell} ${desktopLayout.heroGrid}`}>
    <div className={`${styles.heroCopy} ${mobile.heroCopy}`}><div className={styles.location}><MapPin size={17}/><span>{locationLabel}</span></div><h1 className={styles.title}>{event.title}</h1>{shortDescription&&<p className={styles.summary}>{shortDescription}</p>}<div className={`${styles.heroActions} ${ctaLayout.actions}`}><a data-event-primary-cta className={`${styles.buyButton} ${ctaLayout.buy}`} href={seatHref??"#tickets"}>{ctaLabel}</a><div className={`${styles.shareWrap} ${ctaLayout.share}`}><EventShareActions title={event.title} url={eventUrl}/></div></div><div className={ctaLayout.viewerPressure}><LiveViewerPressure locale={i18n.locale}/></div></div>
    <EventHeroGallery title={event.title} posterUrl={event.posterUrl} videoUrl={heroVideo} galleryUrls={presentation.galleryEnabled?presentation.galleryUrls:[]}/>
   </div>
   <div className={`${metaAlignment.shell} ${desktopLayout.wideShell}`}><EventMetaStrip locale={i18n.locale} startsAt={event.startsAt.toISOString()} date={eventDay(event.startsAt,i18n.locale)} startTime={eventStartTime(event.startsAt,i18n.locale)} doorsOpenTime={presentation.doorsOpenTime} city={event.venue.city} venue={event.venue.name} address={event.venue.address} ageRestriction={presentation.ageRestriction}/></div>
  </section>
  <section className={`${styles.body} ${bodyLayout.body}`}><div className={`shell ${styles.bodyGrid} ${bodyLayout.shell} ${bodyLayout.grid} ${desktopLayout.wideShell} ${desktopLayout.bodyGrid}`}>
   <div className={bodyLayout.leftColumn}><EventMobileVideo title={event.title} videoUrl={heroVideo} posterUrl={event.posterUrl}/><article className={`${styles.contentCard} ${bodyLayout.content}`}>
    {publicDescription?<EventAboutCard heading={local.about} title={event.title} description={publicDescription} posterUrl={event.posterUrl} readMore={local.readMore} readLess={local.readLess}/>:<h2>{local.about}</h2>}
    <EventFactsGrid locale={i18n.locale} runtimeMinutes={presentation.runtimeMinutes} intermissionCount={presentation.intermissionCount} venue={event.venue.name} address={event.venue.address} city={event.venue.city} categories={publicCategoryLabels} ageRestriction={presentation.ageRestriction} startDate={eventDay(event.startsAt,i18n.locale)}/>
    {presentation.faqEnabled&&presentation.faq.length>0&&<EventFaq title={local.faq} items={presentation.faq}/>} {links.length>0&&<div className={styles.links}>{links.map((item,index)=><a key={`${item.url}-${index}`} className={styles.externalLink} href={item.url} target="_blank" rel="noreferrer"><span>{item.title||new URL(item.url).hostname}</span><ExternalLink size={15}/></a>)}</div>}
   </article></div>
   <aside id="tickets" className={styles.ticketsColumn}>{validPromoterLink&&<div className={styles.promoterCard}><strong>{text.personalLink}: {validPromoterLink.label}</strong><p>{text.personalLinkInfo}</p></div>}{categories.length?<div className={styles.ticketCard}>{event.mapEnabled?<SeatMapPurchaseCard slug={event.slug} title={event.title} categories={categories} objects={objects} referralCode={validPromoterLink?.code}/>:<GeneralAdmissionPurchase eventId={event.id} eventSlug={event.slug} eventTitle={event.title} posterUrl={event.posterUrl} categories={categories} feeTerms={feeTerms} referralCode={validPromoterLink?.code} allocationCategoryId={validPromoterLink?.allocationType==="CATEGORY"?validPromoterLink.categoryId:null}/>}</div>:<div className={styles.closedCard}><strong>{text.salesClosed}</strong><p>{text.noTariffs}</p></div>}</aside>
  </div></section>
  {categories.length>0&&<EventMobileStickyCta priceLabel={mobilePriceLabel} actionLabel={event.mapEnabled?local.pick:local.buy} locale={i18n.locale} actionHref={seatHref}/>} 
 </main>;
}
