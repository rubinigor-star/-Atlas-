import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { eventDate, money } from "@/lib/format";
import { effectiveTicketPrice } from "@/lib/ticketing";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";
import { stripPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { stripEventMedia } from "@/lib/event-media";
import { stripEventRejectionMessage } from "@/lib/event-approval-message";
import { stripBuyerQuestions } from "@/lib/buyer-questions";
import { stripEventMarkers } from "@/lib/event-guest-fields";
import { stripEventType } from "@/lib/event-type";

export const dynamic="force-dynamic";

export default async function DraftPreview({params}:{params:Promise<{id:string}>}){
 const{id}=await params;
 await requireEventAccess("EVENT_VIEW",id);
 const event=await db.event.findUnique({where:{id},include:{venue:true,categories:{include:{priceTiers:true}}}});
 if(!event)notFound();
 const terms=await getEffectiveEventTerms(event.id,event.organizationId);
 const now=new Date();
 const categories=event.categories.flatMap(category=>{
  try{
   const basePrice=effectiveTicketPrice(category,now);
   const pricing=calculateServiceFee(basePrice,{salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer});
   return[{...category,description:stripPricingMarketingStrategy(category.description),currentPrice:pricing.buyerTotalMinor}];
  }catch{return[]}
 });
 const publicDescription=stripEventType(stripEventMarkers(stripBuyerQuestions(stripEventRejectionMessage(stripEventMedia(event.description))))).trim();
 return <AdminShell><div className="row between"><div><span className="eyebrow">Предварительный просмотр</span><h1>{event.title}</h1><p className="muted">Так основные данные и финальные цены будут выглядеть для покупателя. Черновик пока не доступен публично.</p></div><Link className="btn secondary" href={`/office/events/${event.id}?tab=review`}>Вернуться к проверке</Link></div><div className="event-experience" style={{marginTop:24}}><aside className="event-media-rail"><div className="event-poster-frame"><Image src={event.posterUrl} fill alt={event.title} className="event-square-poster" sizes="390px"/></div></aside><section className="event-content-panel event-info"><span className="pill">{event.status}</span><h1>{event.title}</h1><div className="meta"><div className="meta-row"><div><strong>{eventDate(event.startsAt,"ru")}</strong></div></div><div className="meta-row"><div><strong>{event.venue.name}</strong><br/><span className="muted">{event.venue.address}, {event.venue.city}</span></div></div></div>{publicDescription&&<section><h2>Описание</h2><p className="muted" style={{whiteSpace:"pre-wrap"}}>{publicDescription}</p></section>}<div className="panel purchase-panel"><h2>Билеты</h2><div className="options">{categories.map(category=><div className="option" key={category.id}><span><strong>{category.name}</strong><br/><small className="muted">{category.description}</small></span><strong>{money(category.currentPrice)}</strong></div>)}</div>{!categories.length&&<p className="muted">Нет активных билетов для текущего периода продаж.</p>}</div></section></div></AdminShell>;
}
