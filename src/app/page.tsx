import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { Mic2, Music2, PartyPopper, Sparkles, Ticket } from "lucide-react";
import "./event-card-grid.css";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { getServerI18n } from "@/lib/server-locale";
import { eventTypeLabels, parseEventType } from "@/lib/event-type";
import { EventLanguagePreferences } from "@/components/event-language-preferences";
import { EVENT_LANGUAGE_COOKIE, parsePreferredEventLanguages } from "@/lib/event-language";
import { getHiddenEventIds } from "@/lib/event-language-server";

export const dynamic = "force-dynamic";

type TourRow={id:string;slug:string;title:string;description:string;posterurl:string|null};
type TourEventRow={tourid:string;eventid:string;position:number};

const intlLocale: Record<Locale,string>={ru:"ru-IL",he:"he-IL",en:"en-IL"};
const rangeWords:Record<Locale,{from:string;to:string}>={
  ru:{from:"с",to:"по"},
  he:{from:"מ־",to:"עד"},
  en:{from:"from",to:"to"},
};

const categoryLabels:Record<Locale,[string,string,string,string,string]>={
  ru:["Концерты","Вечеринки","Шоу","Стендап","Все события"],
  he:["הופעות","מסיבות","מופעים","סטנדאפ","כל האירועים"],
  en:["Concerts","Parties","Shows","Stand-up","All events"],
};

function displayCity(value:string,locale:Locale){
  const lowered=value.trim().toLocaleLowerCase(intlLocale[locale]);
  return lowered.replace(/\p{L}+/gu,(word)=>word.charAt(0).toLocaleUpperCase(intlLocale[locale])+word.slice(1));
}

function shortDate(date:Date,locale:Locale){
  return new Intl.DateTimeFormat(intlLocale[locale],{
    day:"numeric",
    month:"long",
    timeZone:"Asia/Jerusalem",
  }).format(date);
}

function shortDateRange(start:Date,end:Date,locale:Locale){
  const words=rangeWords[locale];
  return `${words.from} ${shortDate(start,locale)} ${words.to} ${shortDate(end,locale)}`;
}

export default async function Home() {
  const { locale, messages } = await getServerI18n();
  const cookieStore = await cookies();
  const preferredEventLanguages = parsePreferredEventLanguages(cookieStore.get(EVENT_LANGUAGE_COOKIE)?.value, locale);
  const hiddenEventIds = await getHiddenEventIds(preferredEventLanguages);
  const events = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      ...(hiddenEventIds.length ? { id: { notIn: hiddenEventIds } } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
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
  const linkedEventIds=new Set(tourLinks.filter(link=>eventById.has(link.eventid)).map(link=>link.eventid));
  const tourCards=tours.map(tour=>{
    const linked=tourLinks
      .filter(link=>link.tourid===tour.id)
      .map(link=>eventById.get(link.eventid))
      .filter(Boolean)
      .sort((a,b)=>a!.startsAt.getTime()-b!.startsAt.getTime()) as typeof events;
    if(!linked.length)return null;
    const prices=linked.flatMap(event=>event.categories.map(category=>category.priceMinor));
    const cities=[...new Set(linked.map(event=>displayCity(event.venue.city,locale)))];
    return {tour,linked,poster:tour.posterurl||linked[0].posterUrl,minimumPrice:prices.length?Math.min(...prices):null,cities};
  }).filter(Boolean) as Array<{tour:TourRow;linked:typeof events;poster:string;minimumPrice:number|null;cities:string[]}>;
  const standaloneEvents=events.filter(event=>!linkedEventIds.has(event.id));
  const totalCards=tourCards.length+standaloneEvents.length;
  const labels=categoryLabels[locale];
  const categories=[
    {label:labels[0],Icon:Music2},
    {label:labels[1],Icon:PartyPopper},
    {label:labels[2],Icon:Sparkles},
    {label:labels[3],Icon:Mic2},
    {label:labels[4],Icon:Ticket},
  ];

  return <main className="home-page">
    <section className="home-hero">
      <div className="home-shell home-hero-inner">
        <div className="home-hero-copy">
          <span className="eyebrow">{messages.home.eyebrow}</span>
          <h1>{messages.home.title}</h1>
          <p>{messages.home.subtitle}</p>
        </div>
        <div className="home-category-grid" aria-label={labels[4]}>
          {categories.map(({label,Icon})=><div className="home-category" key={label}>
            <span className="home-category-icon"><Icon aria-hidden="true" size={28} strokeWidth={1.8}/></span>
            <span>{label}</span>
          </div>)}
        </div>
      </div>
    </section>

    <section className="home-shell home-events" id="events">
      <div className="home-events-head">
        <div><h2 className="section-title">{messages.home.upcoming}</h2><span className="muted">{totalCards} {messages.home.eventCount}</span></div>
        <EventLanguagePreferences locale={locale} initial={preferredEventLanguages}/>
      </div>
      <div className="event-grid">
        {tourCards.map(({tour,linked,poster,minimumPrice,cities},index)=>{const cityLine=cities.join(" · ");return <Link className="card" href={`/tours/${tour.slug}`} key={tour.id}>
          <Image src={poster} width={750} height={750} alt={tour.title} className="card-img" priority={index===0} sizes="(max-width: 520px) 50vw, (max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw"/>
          <div className="card-body">
            <span className="pill card-tag">{messages.home.tour} · {linked.length} {messages.home.dates}</span>
            <h3 className="card-title">{tour.title}</h3>
            <div className="muted card-cities" title={cityLine}>{cityLine}</div>
            <p className="card-date">{shortDateRange(linked[0].startsAt,linked[linked.length-1].startsAt,locale)}</p>
            <div className="row between card-actions"><strong>{minimumPrice===null?messages.home.salesSoon:`${messages.home.from} ${money(minimumPrice,"ILS",locale)}`}</strong><span className="btn">{messages.home.chooseCity}</span></div>
          </div>
        </Link>})}
        {standaloneEvents.map((event,index)=>{const minimumPrice=event.categories.length?Math.min(...event.categories.map(category=>category.priceMinor)):null;const city=displayCity(event.venue.city,locale);const eventType=parseEventType(event.description);return <Link className="card" href={`/events/${event.slug}`} key={event.id}>
          <Image src={event.posterUrl} width={750} height={750} alt={event.title} className="card-img" priority={tourCards.length===0&&index===0} sizes="(max-width: 520px) 50vw, (max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw"/>
          <div className="card-body">
            <span className="pill card-tag">{eventTypeLabels[locale][eventType]}</span>
            <h3 className="card-title">{event.title}</h3>
            <div className="muted card-cities" title={city}>{city}</div>
            <p className="card-date">{shortDate(event.startsAt,locale)}</p>
            <div className="row between card-actions"><strong>{minimumPrice===null?messages.home.salesSoon:`${messages.home.from} ${money(minimumPrice,"ILS",locale)}`}</strong><span className="btn">{messages.home.choose}</span></div>
          </div>
        </Link>})}
      </div>
    </section>
  </main>;
}
