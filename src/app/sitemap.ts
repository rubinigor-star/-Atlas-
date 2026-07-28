import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE = "https://www.atlas-one.co";
type TourSitemapRow={slug:string;updatedat:Date|string|null};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await db.event.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
  });

  let tours:TourSitemapRow[]=[];
  try{
    tours=await db.$queryRawUnsafe<TourSitemapRow[]>(`SELECT slug, updatedat FROM tour`);
  }catch{
    tours=[];
  }

  const staticPages = ["", "/about", "/faq", "/careers", "/contact", "/privacy", "/terms", "/refund-policy"];
  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${BASE}/events/${event.slug}`,
    lastModified: event.updatedAt,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  const tourEntries:MetadataRoute.Sitemap=tours.map((tour)=>({
    url:`${BASE}/tours/${tour.slug}`,
    lastModified:tour.updatedat?new Date(tour.updatedat):undefined,
    changeFrequency:"weekly",
    priority:0.85,
  }));

  return [...staticEntries, ...tourEntries, ...eventEntries];
}
