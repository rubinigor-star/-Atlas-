import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE="https://www.atlas-one.co";

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const events=await db.event.findMany({where:{status:"PUBLISHED"},select:{slug:true,updatedAt:true}});
  const staticPages=["","/about","/faq","/careers","/contact","/privacy","/terms","/refund-policy"];
  return [
    ...staticPages.map(path=>({url:`${BASE}${path}`,lastModified:new Date(),changeFrequency:path===""?"daily":"monthly" as const,priority:path===""?1:0.7})),
    ...events.map(event=>({url:`${BASE}/events/${event.slug}`,lastModified:event.updatedAt,changeFrequency:"daily" as const,priority:0.9})),
  ];
}
