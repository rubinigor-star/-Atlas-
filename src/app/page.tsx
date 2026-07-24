import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";

export const revalidate = 60;

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
      categories: {
        where: { hidden: false },
        select: { priceMinor: true },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return (
    <main>
      <section className="hero shell">
        <span className="eyebrow">Live experiences in Israel</span>
        <h1>Билеты, ради которых хочется выйти из дома.</h1>
        <p>Концерты, вечеринки и специальные события. Простой выбор, прозрачная цена и билет сразу после оформления.</p>
      </section>
      <section className="shell">
        <div className="row between">
          <h2 className="section-title">Ближайшие события</h2>
          <span className="muted">{events.length} событие</span>
        </div>
        <div className="event-grid">
          {events.map((event, index) => {
            const minimumPrice = event.categories.length
              ? Math.min(...event.categories.map((category) => category.priceMinor))
              : null;
            return (
              <Link className="card" href={`/events/${event.slug}`} key={event.id}>
                <Image
                  src={event.posterUrl}
                  width={900}
                  height={700}
                  alt={event.title}
                  className="card-img"
                  priority={index === 0}
                  sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="card-body">
                  <span className="pill">{event.venue.city}</span>
                  <h3>{event.title}</h3>
                  <div className="muted">{eventDate(event.startsAt)}</div>
                  <p>{event.venue.name}</p>
                  <div className="row between">
                    <strong>{minimumPrice === null ? "Продажи скоро" : `от ${money(minimumPrice)}`}</strong>
                    <span className="btn">Выбрать</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
