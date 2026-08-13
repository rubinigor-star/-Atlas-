import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { stripEventMedia } from "@/lib/event-media";
import { stripEventRejectionMessage } from "@/lib/event-approval-message";
import { stripPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { stripEventType } from "@/lib/event-type";
import { parseEventPresentation, stripEventPresentation } from "@/lib/event-presentation";
import { stripEventMarkers } from "@/lib/event-guest-fields";
import { stripBuyerQuestions } from "@/lib/buyer-questions";
import { getCanonicalOrigin } from "@/lib/public-origin";
import { getEventLanguageSettings } from "@/lib/event-language-server";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";
import { describeCategoryPrice } from "@/lib/ticketing";
import { isTechnicalEventSlug } from "@/lib/event-seo";

type Props={children:React.ReactNode;params:Promise<{slug:string}>};

function cleanDescription(value:string){
  return stripEventPresentation(
    stripEventType(
      stripEventMarkers(
        stripBuyerQuestions(
          stripEventRejectionMessage(
            stripEventMedia(stripPricingMarketingStrategy(value)),
          ),
        ),
      ),
    ),
  ).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

function schemaLanguage(primaryLanguage:string){
  if(primaryLanguage==="RU")return "ru";
  if(primaryLanguage==="HE")return "he";
  if(primaryLanguage==="EN")return "en";
  if(primaryLanguage==="AR")return "ar";
  return undefined;
}

async function getEvent(slug:string){
  return db.event.findUnique({
    where:{slug},
    include:{venue:true,organization:true,categories:{where:{hidden:false},include:{priceTiers:true}}},
  });
}

export async function generateMetadata({params}:Pick<Props,"params">):Promise<Metadata>{
  const {slug}=await params;
  const event=await getEvent(slug);
  if(!event||event.status!=="PUBLISHED")return {title:"Событие не найдено",robots:{index:false,follow:false}};
  const settings=await getEventLanguageSettings(event.id);
  const base=getCanonicalOrigin();
  const url=`${base}/events/${event.slug}`;
  const description=cleanDescription(event.description).slice(0,160)||`${event.title} в ${event.venue.city}. Покупка билетов онлайн на Atlas One.`;
  const title=`${event.title} - ${event.venue.city}`;
  const noIndex=settings.catalogVisibility==="DIRECT_ONLY"||isTechnicalEventSlug(event.slug);
  return {
    title,
    description,
    alternates:{canonical:url},
    robots:noIndex?{index:false,follow:true}:undefined,
    openGraph:{type:"website",url,siteName:"Atlas One",title,description,images:[{url:event.posterUrl,alt:event.title}]},
    twitter:{card:"summary_large_image",title,description,images:[event.posterUrl]},
  };
}

export default async function EventLayout({children,params}:Props){
  const {slug}=await params;
  const event=await getEvent(slug);
  if(!event||event.status!=="PUBLISHED")notFound();
  const settings=await getEventLanguageSettings(event.id);
  if(settings.catalogVisibility==="DIRECT_ONLY"||isTechnicalEventSlug(event.slug))return children;
  const now=new Date();
  const base=getCanonicalOrigin();
  const url=`${base}/events/${event.slug}`;
  const terms=await getEffectiveEventTerms(event.id,event.organizationId);
  const feeTerms={salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer};
  const offers=event.categories.flatMap((category)=>{
    const priceState=describeCategoryPrice(category,now);
    const categorySalesStart=category.salesStart??event.salesStart;
    const categorySalesEnd=category.salesEnd??event.salesEnd;
    const basePriceMinor=priceState.currentPriceMinor??category.priceMinor;
    const buyerPriceMinor=calculateServiceFee(basePriceMinor,feeTerms).buyerTotalMinor;
    const availability=category.sold>=category.capacity?"https://schema.org/SoldOut":now>=categorySalesStart&&now<categorySalesEnd?"https://schema.org/InStock":undefined;
    return [{
      "@type":"Offer",
      url,
      price:(buyerPriceMinor/100).toFixed(2),
      priceCurrency:category.currency,
      validFrom:categorySalesStart.toISOString(),
      ...(availability?{availability}:{}),
    }];
  });
  const inLanguage=schemaLanguage(settings.primaryLanguage);
  const presentation=parseEventPresentation(event.description);
  const endDate=presentation.runtimeMinutes>0?new Date(event.startsAt.getTime()+presentation.runtimeMinutes*60_000).toISOString():undefined;
  const schema={"@context":"https://schema.org","@type":"Event","@id":`${url}#event`,name:event.title,description:cleanDescription(event.description),image:[new URL(event.posterUrl,base).toString()],startDate:event.startsAt.toISOString(),...(endDate?{endDate}:{}),eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",location:{"@type":"Place",name:event.venue.name,address:{"@type":"PostalAddress",streetAddress:event.venue.address,addressLocality:event.venue.city,addressCountry:"IL"}},organizer:{"@type":"Organization",name:event.organization.name},url,offers,...(inLanguage?{inLanguage}:{})};
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Atlas One",item:base},{"@type":"ListItem",position:2,name:event.title,item:url}]};
  const safeJson=(value:unknown)=>JSON.stringify(value).replace(/</g,"\\u003c");
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(schema)}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(breadcrumb)}}/>{children}</>;
}
