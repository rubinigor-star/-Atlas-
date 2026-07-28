import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";
import { getServerI18n } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

type TourRow={id:string;slug:string;title:string;description:string;posterurl:string|null};
type TourEventRow={tourid:string;eventid:string;position:number};

export default async function Home() {
  const { locale, messages } = await getServerI18n();
  const events = await db.event.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      posterUrl: true,
      startsAt: true,
      venue: { select: { city: true, name: true } },
      categories: { where: { hidden: false }, select: { priceMinor: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  let tours:TourRow[]=[];
  let tourLinks:TourEventRow[]=[];
  try{
    tours=await db.$queryRawUnsafe<TourRow[]>(`SELECT id,slug,title,description,posterurl FROM tour ORDER BY createdat DESC`);
    tourLinks=await db.$queryRawUnsafe<TourEventRow[]>(`SELECT tourid,eventid,position FROM tourevent ORDER BY position ASC`);
  }catch{
    tours=[];tourLinks=[];
  }

  const eventById=new Map(events.map(event=>[event.id,event]));
  const linkedEventIds=new Set(tourLinks.map(link=>link.eventid));
  const tourCards=tours.map(tour=>{
    const linked=tourLinks.filter(link=>link.tourid===tour.id).map(link=>eventById.get(link.eventid)).filter(Boolean) as typeof events;
    if(!linked.length)return null;
    const prices=linked.flatMap(event=>event.categories.map(category=>category.priceMinor));
    const cities=[...new Set(linked.map(event=>event.venue.city))];
    return {tour,linked,poster:tour.posterurl||linked[0].posterUrl,minimumPrice:prices.length?Math.min(...prices):null,cities};
  }).filter(Boolean) as Array<{tour:TourRow;linked:typeof events;poster:string;minimumPrice:number|null;cities:string[]}>;
  const standaloneEvents=events.filter(event=>!linkedEventIds.has(event.id));
  const totalCards=tourCards.length+standaloneEvents.length;

  return <main>
    <style>{`.event-grid .card-img{aspect-ratio:4/5!important;object-fit:contain!important;background:#0b1220}`}</style>
    <section className="hero shell"><span className="eyebrow">{messages.home.eyebrow}</span><h1>{messages.home.title}</h1><p>{messages.home.subtitle}</p></section>
    <section className="shell">
      <div className="row between"><h2 className="section-title">{messages.home.upcoming}</h2><span className="muted">{totalCards} {messages.home.eventCount}</span></div>
      <div className="event-grid">
        {tourCards.map(({tour,linked,poster,minimumPrice,cities},index)=><Link className="card" href={`/tours/${tour.slug}`} key={tour.id}>
          <Image src={poster} width={900} height={1125} alt={tour.title} className="card-img" priority={index===0} sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
          <div className="card-body"><span className="pill">{messages.home.tour} · {linked.length} {messages.home.dates}</span><h3>{tour.title}</h3><div className="muted">{cities.join(" · ")}</div><p>{eventDate(linked[0].startsAt,locale)} — {eventDate(linked[linked.length-1].startsAt,locale)}</p><div className="row between"><strong>{minimumPrice===null?messages.home.salesSoon:`${messages.home.from} ${money(minimumPrice,"ILS",locale)}`}</strong><span className="btn">{messages.home.chooseCity}</span></div></div>
        </Link>)}
        {standaloneEvents.map((event,index)=>{const minimumPrice=event.categories.length?Math.min(...event.categories.map(category=>category.priceMinor)):null;return <Link className="card" href={`/events/${event.slug}`} key={event.id}>
          <Image src={event.posterUrl} width={900} height={1125} alt={event.title} className="card-img" priority={tourCards.length===0&&index===0} sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
          <div className="card-body"><span className="pill">{event.venue.city}</span><h3>{event.title}</h3><div className="muted">{eventDate(event.startsAt,locale)}</div><p>{event.venue.name}</p><div className="row between"><strong>{minimumPrice===null?messages.home.salesSoon:`${messages.home.from} ${money(minimumPrice,"ILS",locale)}`}</strong><span className="btn">{messages.home.choose}</span></div></div>
        </Link>})}
      </div>
    </section>
  </main>;
}