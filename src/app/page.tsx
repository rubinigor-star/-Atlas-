import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import "./event-card-grid.css";
import "./live-emotions-hero.css";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { getServerI18n } from "@/lib/server-locale";
import { eventTypeLabels, parseEventType, type EventType } from "@/lib/event-type";
import { EventLanguagePreferences } from "@/components/event-language-preferences";
import { EVENT_LANGUAGE_COOKIE, parsePreferredEventLanguages } from "@/lib/event-language";
import { getHiddenEventIds } from "@/lib/event-language-server";

export const dynamic = "force-dynamic";

type TourRow={id:string;slug:string;title:string;description:string;posterurl:string|null};
type TourEventRow={tourid:string;eventid:string;position:number};
type MarqueeRow={eventId:string;position:number};
type CategoryKey="children"|"theatre"|"concerts"|"standup"|"clubs"|"deals";

const intlLocale: Record<Locale,string>={ru:"ru-IL",he:"he-IL",en:"en-IL"};
const rangeWords:Record<Locale,{from:string;to:string}>={
  ru:{from:"с",to:"по"},
  he:{from:"מ־",to:"עד"},
  en:{from:"from",to:"to"},
};

const categoryKeys:CategoryKey[]=["children","theatre","concerts","standup","clubs","deals"];
const categoryTypes:Record<CategoryKey,EventType[]|null>={
  children:["CHILDREN_SHOW"],
  theatre:["THEATRE"],
  concerts:["SOLO_CONCERT","LIVE_MUSIC","CLASSICAL_CONCERT"],
  standup:["COMEDY"],
  clubs:["FESTIVAL","PARTY","DJ_SET"],
  deals:null,
};

const heroCategories:Array<{key:CategoryKey;icon:string}>=[
  {key:"children",icon:"🧸"},
  {key:"theatre",icon:"🎭"},
  {key:"concerts",icon:"🎸"},
  {key:"standup",icon:"🎙️"},
  {key:"clubs",icon:"⚡"},
  {key:"deals",icon:"🏷️"},
];

const heroCopy:Record<Locale,{
  before:string;
  accent:string;
  after:string;
  description:[string,string];
  carousel:string;
  categories:Record<CategoryKey,string>;
}>={
  ru:{
    before:"ЖИВЫЕ",
    accent:"ЭМОЦИИ",
    after:"ЗДЕСЬ.",
    description:["Концерты, вечеринки и специальные события.","Простой выбор, прозрачная цена и билет сразу после оформления."],
    carousel:"Актуальные мероприятия Atlas",
    categories:{children:"Детские",theatre:"Театр",concerts:"Концерты",standup:"Stand-up",clubs:"Клубы и фестивали",deals:"Выгодные предложения"},
  },
  he:{
    before:"חוויה",
    accent:"שמעוררת",
    after:"התרגשות.",
    description:["הופעות, מסיבות ואירועים מיוחדים.","הזמנה פשוטה, מחיר שקוף והכרטיס אצלכם מיד בסיום הרכישה."],
    carousel:"האירועים העדכניים של Atlas",
    categories:{children:"ילדים",theatre:"תיאטרון",concerts:"הופעות",standup:"סטנדאפ",clubs:"מועדונים ופסטיבלים",deals:"מבצעים"},
  },
  en:{
    before:"LIVE",
    accent:"EMOTIONS",
    after:"START HERE.",
    description:["Concerts, parties and special events.","Easy booking, transparent pricing, and your ticket instantly after checkout."],
    carousel:"Current Atlas events",
    categories:{children:"Kids",theatre:"Theatre",concerts:"Concerts",standup:"Stand-up",clubs:"Clubs & festivals",deals:"Deals"},
  },
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

export default async function Home({searchParams}:{searchParams:Promise<{category?:string}>}) {
  const [{ locale, messages },params,cookieStore]=await Promise.all([getServerI18n(),searchParams,cookies()]);
  const selectedCategory=categoryKeys.includes(params.category as CategoryKey)?params.category as CategoryKey:null;
  const preferredEventLanguages = parsePreferredEventLanguages(cookieStore.get(EVENT_LANGUAGE_COOKIE)?.value, locale);

  const [allEvents,hiddenEventIds,tours,tourLinks,marqueeRows]=await Promise.all([
    db.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
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
    }),
    getHiddenEventIds(preferredEventLanguages),
    db.$queryRawUnsafe<TourRow[]>(`SELECT id,slug,title,description,posterurl FROM tour ORDER BY createdat DESC`).catch(()=>[] as TourRow[]),
    db.$queryRawUnsafe<TourEventRow[]>(`SELECT tourid,eventid,position FROM tourevent ORDER BY position ASC`).catch(()=>[] as TourEventRow[]),
    db.$queryRawUnsafe<MarqueeRow[]>(`SELECT "eventId","position" FROM "HomeMarqueeEvent" WHERE "active"=TRUE ORDER BY "position" ASC`).catch(()=>[] as MarqueeRow[]),
  ]);

  const hiddenEventIdSet=new Set(hiddenEventIds);
  const events=hiddenEventIdSet.size?allEvents.filter(event=>!hiddenEventIdSet.has(event.id)):allEvents;

  type EventRow=(typeof events)[number];
  type TourCard={tour:TourRow;linked:EventRow[];poster:string;minimumPrice:number|null;cities:string[]};

  const buildCards=(sourceEvents:EventRow[])=>{
    const eventById=new Map(sourceEvents.map(event=>[event.id,event]));
    const linkedEventIds=new Set(tourLinks.filter(link=>eventById.has(link.eventid)).map(link=>link.eventid));
    const tourCards=tours.map(tour=>{
      const linked=tourLinks
        .filter(link=>link.tourid===tour.id)
        .map(link=>eventById.get(link.eventid))
        .filter(Boolean)
        .sort((a,b)=>a!.startsAt.getTime()-b!.startsAt.getTime()) as EventRow[];
      if(!linked.length)return null;
      const poster=tour.posterurl||linked[0].posterUrl;
      if(!poster)return null;
      const prices=linked.flatMap(event=>event.categories.map(category=>category.priceMinor));
      const cities=[...new Set(linked.map(event=>displayCity(event.venue.city,locale)))];
      return {tour,linked,poster,minimumPrice:prices.length?Math.min(...prices):null,cities};
    }).filter(Boolean) as TourCard[];
    const standaloneEvents=sourceEvents.filter(event=>!linkedEventIds.has(event.id));
    return {tourCards,standaloneEvents,totalCards:tourCards.length+standaloneEvents.length};
  };

  const selectedTypes=selectedCategory?categoryTypes[selectedCategory]:null;
  const filteredEvents=selectedTypes
    ?events.filter(event=>selectedTypes.includes(parseEventType(event.description)))
    :events;
  const visibleCards=buildCards(filteredEvents);
  const copy=heroCopy[locale];

  const marqueeEventById=new Map(events.map(event=>[event.id,event]));
  const now=Date.now();
  const marqueeCards=marqueeRows
    .map(row=>marqueeEventById.get(row.eventId))
    .filter((event):event is EventRow=>Boolean(event&&event.startsAt.getTime()>=now))
    .map(event=>({
      id:`event-${event.id}`,
      href:`/events/${event.slug}`,
      title:event.title,
      poster:event.posterUrl,
      meta:`${displayCity(event.venue.city,locale)} · ${shortDate(event.startsAt,locale)}`,
    }));

  return <main className="home-page">
    <section className="live-emotions-hero" aria-labelledby="live-emotions-title">
      <div className="live-emotions-shell">
        <h1 id="live-emotions-title" className="live-emotions-title">
          {copy.before&&<span>{copy.before}</span>}
          <span className="live-emotions-accent">{copy.accent}</span>
          {copy.after&&<span>{copy.after}</span>}
        </h1>

        <nav className="live-emotions-categories" aria-label={messages.common.events}>
          {heroCategories.map(({key,icon})=><Link
            href={`/?category=${key}#events`}
            prefetch={false}
            className="live-emotions-category"
            data-active={selectedCategory===key?"true":"false"}
            key={key}
          >
            <span className="live-emotions-category-icon" aria-hidden="true">{icon}</span>
            <span>{copy.categories[key]}</span>
          </Link>)}
        </nav>

        <p className="live-emotions-description">
          <span>{copy.description[0]}</span>
          <span>{copy.description[1]}</span>
        </p>
      </div>

      {marqueeCards.length>0&&<div className="live-events-marquee" aria-label={copy.carousel}>
        <div className="live-events-track" data-direction={locale==="he"?"rtl":"ltr"}>
          {[false,true].map(duplicate=><div className="live-events-group" aria-hidden={duplicate?"true":undefined} key={duplicate?"duplicate":"primary"}>
            {marqueeCards.map((card,index)=><Link
              href={card.href}
              prefetch={false}
              className="live-event-preview"
              tabIndex={duplicate?-1:undefined}
              key={`${duplicate?"duplicate":"primary"}-${card.id}`}
            >
              <Image
                src={card.poster}
                width={750}
                height={750}
                alt={duplicate?"":card.title}
                className="live-event-preview-image"
                priority={!duplicate&&index<2}
                quality={68}
                sizes="(max-width: 520px) 44vw, (max-width: 900px) 30vw, 250px"
              />
              <span className="live-event-preview-copy">
                <strong>{card.title}</strong>
                <small>{card.meta}</small>
              </span>
            </Link>)}
          </div>)}
        </div>
      </div>}
    </section>

    <section className="home-shell home-events" id="events">
      <div className="home-events-head">
        <div><h2 className="section-title">{messages.home.upcoming}</h2><span className="muted">{visibleCards.totalCards} {messages.home.eventCount}</span></div>
        <EventLanguagePreferences locale={locale} initial={preferredEventLanguages}/>
      </div>
      <div className="event-grid">
        {visibleCards.tourCards.map(({tour,linked,poster,minimumPrice,cities})=>{const cityLine=cities.join(" · ");return <Link className="card" href={`/tours/${tour.slug}`} prefetch={false} key={tour.id}>
          <Image src={poster} width={750} height={750} alt={tour.title} className="card-img" quality={72} sizes="(max-width: 520px) 50vw, (max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw"/>
          <div className="card-body">
            <span className="pill card-tag">{messages.home.tour} · {linked.length} {messages.home.dates}</span>
            <h3 className="card-title">{tour.title}</h3>
            <div className="muted card-cities" title={cityLine}>{cityLine}</div>
            <p className="card-date">{shortDateRange(linked[0].startsAt,linked[linked.length-1].startsAt,locale)}</p>
            <div className="row between card-actions"><strong>{minimumPrice===null?messages.home.salesSoon:`${messages.home.from} ${money(minimumPrice,"ILS",locale)}`}</strong><span className="btn">{messages.home.chooseCity}</span></div>
          </div>
        </Link>})}
        {visibleCards.standaloneEvents.map(event=>{const minimumPrice=event.categories.length?Math.min(...event.categories.map(category=>category.priceMinor)):null;const city=displayCity(event.venue.city,locale);const eventType=parseEventType(event.description);return <Link className="card" href={`/events/${event.slug}`} prefetch={false} key={event.id}>
          <Image src={event.posterUrl} width={750} height={750} alt={event.title} className="card-img" quality={72} sizes="(max-width: 520px) 50vw, (max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw"/>
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
