import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {db} from "@/lib/db";
import {eventDate,money} from "@/lib/format";
import {effectiveTicketPrice} from "@/lib/ticketing";
import {getEffectiveEventTerms} from "@/lib/commercial-terms";
import {calculateServiceFee} from "@/lib/service-fee";

export const dynamic="force-dynamic";
type TourRow={id:string;slug:string;title:string;description:string;posterurl:string|null};
type TourEventRow={eventid:string;position:number};

export default async function TourPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  let tour:TourRow|undefined;let links:TourEventRow[]=[];
  try{
    [tour]=await db.$queryRawUnsafe<TourRow[]>(`SELECT id,slug,title,description,posterurl FROM tour WHERE slug=$1 LIMIT 1`,slug);
    if(tour)links=await db.$queryRawUnsafe<TourEventRow[]>(`SELECT eventid,position FROM tourevent WHERE tourid=$1 ORDER BY position ASC`,tour.id);
  }catch{return notFound();}
  if(!tour)return notFound();
  const ids=links.map(item=>item.eventid);
  const events=await db.event.findMany({where:{id:{in:ids},status:"PUBLISHED"},include:{venue:true,categories:{include:{priceTiers:true}}}});
  const byId=new Map(events.map(event=>[event.id,event]));
  const ordered=ids.map(id=>byId.get(id)).filter(Boolean) as typeof events;
  const now=new Date();
  const priced=await Promise.all(ordered.map(async event=>{
    const terms=await getEffectiveEventTerms(event.id,event.organizationId);
    const feeTerms={salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer};
    const prices=event.categories.filter(c=>!c.hidden).flatMap(category=>{try{return [calculateServiceFee(effectiveTicketPrice(category,now),feeTerms).buyerTotalMinor];}catch{return [];}});
    return {event,from:prices.length?Math.min(...prices):0};
  }));
  return <main>
    <section className="tour-hero"><div className="shell tour-hero-grid"><div>{tour.posterurl&&<Image src={tour.posterurl} alt={tour.title} width={900} height={1125} className="tour-poster"/>}</div><div className="tour-copy"><span className="eyebrow">Atlas One Tour</span><h1>{tour.title}</h1><p>{tour.description}</p><a href="#dates" className="btn">Выбрать город и дату</a></div></div></section>
    <section className="shell" id="dates"><h2 className="section-title">Даты тура</h2><div className="tour-dates">{priced.map(({event,from})=>{const soldOut=event.categories.length>0&&event.categories.every(c=>c.sold>=c.capacity);return <article key={event.id} className="tour-date-card"><div><span className="pill">{event.venue.city}</span><h3>{eventDate(event.startsAt)}</h3><p>{event.venue.name}<br/><small>{event.venue.address}</small></p></div><div className="tour-date-action"><strong>{from?`от ${money(from)}`:"Цена будет объявлена"}</strong>{soldOut?<span className="pill">Sold out</span>:<Link className="btn" href={`/events/${event.slug}`}>Выбрать билеты</Link>}</div></article>})}{!priced.length&&<div className="panel">Опубликованные даты скоро появятся.</div>}</div></section>
  </main>;
}
