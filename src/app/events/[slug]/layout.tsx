import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

const BASE="https://www.atlas-one.co";

async function getEvent(slug:string){return db.event.findUnique({where:{slug},include:{venue:true,categories:{where:{hidden:false},select:{priceMinor:true,currency:true}}}})}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;const event=await getEvent(slug);if(!event||event.status!=="PUBLISHED")return {};
  const description=event.description.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,155);
  const url=`${BASE}/events/${event.slug}`;
  return {title:event.title,description,alternates:{canonical:url},openGraph:{type:"website",url,title:event.title,description,images:[{url:event.posterUrl,alt:event.title}]},twitter:{card:"summary_large_image",title:event.title,description,images:[event.posterUrl]}};
}

export default async function EventLayout({children,params}:{children:React.ReactNode;params:Promise<{slug:string}>}){
  const {slug}=await params;const event=await getEvent(slug);if(!event||event.status!=="PUBLISHED")notFound();
  const prices=event.categories.map(c=>c.priceMinor);const minimum=prices.length?Math.min(...prices):undefined;
  const schema={"@context":"https://schema.org","@type":"Event",name:event.title,description:event.description.replace(/<[^>]+>/g," ").trim(),image:[new URL(event.posterUrl,BASE).toString()],startDate:event.startsAt.toISOString(),endDate:event.salesEnd.toISOString(),eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",location:{"@type":"Place",name:event.venue.name,address:{"@type":"PostalAddress",streetAddress:event.venue.address,addressLocality:event.venue.city,addressCountry:"IL"}},organizer:{"@type":"Organization",name:"Atlas One",url:BASE},url:`${BASE}/events/${event.slug}`,...(minimum!==undefined?{offers:{"@type":"Offer",url:`${BASE}/events/${event.slug}`,price:(minimum/100).toFixed(2),priceCurrency:event.categories[0]?.currency||"ILS",availability:"https://schema.org/InStock",validFrom:event.salesStart.toISOString()}}:{})};
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"События",item:BASE},{"@type":"ListItem",position:2,name:event.title,item:`${BASE}/events/${event.slug}`}]};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumb)}}/>{children}</>;
}
