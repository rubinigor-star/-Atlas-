import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { stripEventMedia } from "@/lib/event-media";
import { stripEventRejectionMessage } from "@/lib/event-approval-message";
import { stripPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { stripEventType } from "@/lib/event-type";

const BASE="https://www.atlas-one.co";
type Props={children:React.ReactNode;params:Promise<{slug:string}>};

function cleanDescription(value:string){
  return stripEventType(stripEventRejectionMessage(stripEventMedia(stripPricingMarketingStrategy(value)))).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

async function getEvent(slug:string){
  return db.event.findUnique({
    where:{slug},
    include:{venue:true,organization:true,categories:{where:{hidden:false},select:{priceMinor:true,currency:true,sold:true,capacity:true}}},
  });
}

export async function generateMetadata({params}:Pick<Props,"params">):Promise<Metadata>{
  const {slug}=await params;
  const event=await getEvent(slug);
  if(!event||event.status!=="PUBLISHED")return {title:"Событие не найдено",robots:{index:false,follow:false}};
  const url=`${BASE}/events/${event.slug}`;
  const description=cleanDescription(event.description).slice(0,160)||`${event.title} в ${event.venue.city}. Покупка билетов онлайн на Atlas One.`;
  const title=`${event.title} - ${event.venue.city}`;
  return {
    title,
    description,
    alternates:{canonical:url},
    openGraph:{type:"website",url,siteName:"Atlas One",title,description,images:[{url:event.posterUrl,alt:event.title}]},
    twitter:{card:"summary_large_image",title,description,images:[event.posterUrl]},
  };
}

export default async function EventLayout({children,params}:Props){
  const {slug}=await params;
  const event=await getEvent(slug);
  if(!event||event.status!=="PUBLISHED")notFound();
  const now=new Date();
  const url=`${BASE}/events/${event.slug}`;
  const offers=event.categories.map((category)=>({
    "@type":"Offer",
    url,
    price:(category.priceMinor/100).toFixed(2),
    priceCurrency:category.currency,
    validFrom:event.salesStart.toISOString(),
    availability:category.sold>=category.capacity?"https://schema.org/SoldOut":now>event.salesEnd?"https://schema.org/Discontinued":"https://schema.org/InStock",
  }));
  const schema={"@context":"https://schema.org","@type":"Event","@id":`${url}#event`,name:event.title,description:cleanDescription(event.description),image:[new URL(event.posterUrl,BASE).toString()],startDate:event.startsAt.toISOString(),eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",location:{"@type":"Place",name:event.venue.name,address:{"@type":"PostalAddress",streetAddress:event.venue.address,addressLocality:event.venue.city,addressCountry:"IL"}},organizer:{"@type":"Organization",name:event.organization.name,url:BASE},url,offers};
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"События",item:BASE},{"@type":"ListItem",position:2,name:event.title,item:url}]};
  const safeJson=(value:unknown)=>JSON.stringify(value).replace(/</g,"\\u003c");
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(schema)}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(breadcrumb)}}/>{children}</>;
}
