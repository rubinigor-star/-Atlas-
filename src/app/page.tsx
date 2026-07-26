import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";

export const revalidate = 60;

type TourRow={id:string;slug:string;title:string;description:string;posterurl:string|null};
type TourEventRow={tourid:string;eventid:string;position:number};

export default async function Home() {
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
    <section className="hero shell"><span className="eyebrow">Live experiences in Israel</span><h1>Билеты, ради которых хочется выйти из дома.</h1><p>Концерты, вечеринки и специальные события. Простой выбор, прозрачная цена и билет сразу после оформления.</p></section>
    <section className="shell">
      <div className="row between"><h2 className="section-title">Ближайшие события</h2><span className="muted">{totalCards} событий</span></div>
      <div className="event-grid">
        {tourCards.map(({tour,linked,poster,minimumPrice,cities},index)=><Link className="card" href={`/tours/${tour.slug}`} key={tour.id}>
          <Image src={poster} width={900} height={700} alt={tour.title} className="card-img" priority={index===0} sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
          <div className="card-body"><span className="pill">Тур · {linked.length} даты</span><h3>{tour.title}</h3><div className="muted">{cities.join(" · ")}</div><p>{eventDate(linked[0].startsAt)} — {eventDate(linked[linked.length-1].startsAt)}</p><div className="row between"><strong>{minimumPrice===null?"Продажи скоро":`от ${money(minimumPrice)}`}</strong><span className="btn">Выбрать город</span></div></div>
        </Link>)}
        {standaloneEvents.map((event,index)=>{const minimumPrice=event.categories.length?Math.min(...event.categories.map(category=>category.priceMinor)):null;return <Link className="card" href={`/events/${event.slug}`} key={event.id}>
          <Image src={event.posterUrl} width={900} height={700} alt={event.title} className="card-img" priority={tourCards.length===0&&index===0} sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
          <div className="card-body"><span className="pill">{event.venue.city}</span><h3>{event.title}</h3><div className="muted">{eventDate(event.startsAt)}</div><p>{event.venue.name}</p><div className="row between"><strong>{minimumPrice===null?"Продажи скоро":`от ${money(minimumPrice)}`}</strong><span className="btn">Выбрать</span></div></div>
        </Link>})}
      </div>
    </section>
  </main>;
}
