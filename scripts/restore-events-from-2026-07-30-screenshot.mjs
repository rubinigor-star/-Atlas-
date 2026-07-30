import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const events = [
  { slug: "pool-party", title: "Группа REFLEX | 26.11 | Tel Aviv Reading 3", startsAt: "2026-11-26T20:30:00+02:00", venueName: "Atlas Rooftop", city: "Tel Aviv" },
  { slug: "jazz-nights", title: "QUEST PISTOLS | 15.10.26 | Tel Aviv Reading 3", startsAt: "2026-10-15T20:30:00+03:00", venueName: "Hangar 11", city: "Tel Aviv" },
  { slug: "sunset-sessions", title: "MALINA FRIDAY | МОНИТО LIVE | 25.09", startsAt: "2026-09-25T20:30:00+03:00", venueName: "Charles Clore Beach", city: "Tel Aviv" },
  { slug: "magic-adventure", title: "Винтаж | 18.09.26 | Tel Aviv Reading 3", startsAt: "2026-09-18T20:30:00+03:00", venueName: "Heichal HaTarbut", city: "Tel Aviv" },
  { slug: "igor-test-payment", title: "LSP | TLV | 27.08", startsAt: "2026-08-28T20:30:00+03:00", venueName: "Hangar 11", city: "Tel Aviv" },
  { slug: "noa-electric-tel-aviv", title: "SAYAM | HAIFA | 21.08", startsAt: "2026-08-21T23:00:00+03:00", venueName: "Hangar 11", city: "Tel Aviv" },
  { slug: "neon-dreams", title: "Сектор газа | TEL AVIV | 20.08", startsAt: "2026-08-20T20:30:00+03:00", venueName: "Hangar 11", city: "Tel Aviv" },
  { slug: "echoes-of-light", title: "Echoes of Light Live", startsAt: "2026-08-15T20:00:00+03:00", venueName: "Hangar 11", city: "Tel Aviv" },
  { slug: "stand-up-night", title: "ANNA ASTI | TEL AVIV | 13.08", startsAt: "2026-08-13T20:30:00+03:00", venueName: "The Box", city: "Tel Aviv" },
  { slug: "techno-united", title: "NEW MALINA | СУПЕРДИСКОТЕКА 90-Х И 2000-Х| 07.08", startsAt: "2026-08-07T23:00:00+03:00", venueName: "The Block", city: "Tel Aviv" },
  { slug: "malina", title: "malina test", startsAt: "2026-07-31T09:24:00+03:00", venueName: "malina", city: "HAIFA" },
];

try {
  for (const item of events) {
    const event = await db.event.findUnique({ where: { slug: item.slug }, select: { id: true, venueId: true } });
    if (!event) {
      console.warn(`Event not found, skipped: ${item.slug}`);
      continue;
    }

    await db.$transaction([
      db.event.update({ where: { id: event.id }, data: { title: item.title, startsAt: new Date(item.startsAt) } }),
      db.venue.update({ where: { id: event.venueId }, data: { name: item.venueName, city: item.city } }),
    ]);
    console.log(`Restored visible event fields: ${item.slug}`);
  }
} finally {
  await db.$disconnect();
}
