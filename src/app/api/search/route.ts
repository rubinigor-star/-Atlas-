import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSearchShowcaseEvents } from "@/lib/search-showcase";

export const dynamic = "force-dynamic";

function serializeEvent(event: {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  startsAt: Date;
  venue: { city: string };
}) {
  return {
    id: event.id,
    href: `/events/${event.slug}`,
    title: event.title,
    posterUrl: event.posterUrl,
    city: event.venue.city,
    startsAt: event.startsAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const featured = await getSearchShowcaseEvents();

  const results = query.length >= 2 ? await db.event.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: query } },
        { venue: { name: { contains: query } } },
        { venue: { city: { contains: query } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      posterUrl: true,
      startsAt: true,
      venue: { select: { city: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 24,
  }) : [];

  return NextResponse.json({
    featured: featured.map(event => ({
      id: event.id,
      href: `/events/${event.slug}`,
      title: event.title,
      posterUrl: event.posterUrl,
      city: event.city,
      startsAt: event.startsAt.toISOString(),
    })),
    results: results.map(serializeEvent),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
