import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getCanonicalOrigin } from "@/lib/public-origin";
import { getDirectOnlyEventIds } from "@/lib/event-language-server";
import { isTechnicalEventSlug } from "@/lib/event-seo";

type TourSitemapRow={slug:string;updatedat:Date|string|null};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base=getCanonicalOrigin();
  const directOnlyIds=new Set(await getDirectOnlyEventIds());
  const publishedEvents = await db.event.findMany({
    where: { status: "PUBLISHED" },
    select: { id:true, slug: true, updatedAt: true },
  });
  const events=publishedEvents.filter((event)=>!directOnlyIds.has(event.id)&&!isTechnicalEventSlug(event.slug));

  let tours:TourSitemapRow[]=[];
  try{
    tours=await db.$queryRawUnsafe<TourSitemapRow[]>(`
      SELECT t.slug, t.updatedat
      FROM tour t
      WHERE EXISTS (
        SELECT 1
        FROM tourevent te
        JOIN Event e ON e.id = te.eventid
        LEFT JOIN "EventLanguageSettings" els ON els."eventId" = e.id
        WHERE te.tourid = t.id
          AND e.status = 'PUBLISHED'
          AND e.slug NOT LIKE 'draft-%'
          AND COALESCE(els."catalogVisibility", 'PUBLIC') <> 'DIRECT_ONLY'
      )
    `);
  }catch{
    tours=[];
  }

  const staticPages = ["", "/about", "/faq", "/careers", "/contact", "/privacy", "/terms", "/cancellation-policy"];
  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${base}/events/${event.slug}`,
    lastModified: event.updatedAt,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  const tourEntries:MetadataRoute.Sitemap=tours.map((tour)=>({
    url:`${base}/tours/${tour.slug}`,
    lastModified:tour.updatedat?new Date(tour.updatedat):undefined,
    changeFrequency:"weekly",
    priority:0.85,
  }));

  return [...staticEntries, ...tourEntries, ...eventEntries];
}
