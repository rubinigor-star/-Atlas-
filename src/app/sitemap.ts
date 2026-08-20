import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getCanonicalOrigin } from "@/lib/public-origin";
import { getDirectOnlyEventIds, getNonIndexableEventIds } from "@/lib/event-language-server";
import { isTechnicalEventSlug } from "@/lib/event-seo";

type TourSitemapRow={id:string;slug:string;updatedat:Date|string|null};
type TourEventRow={eventid:string};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base=getCanonicalOrigin();
  const directOnlyIds=new Set(await getDirectOnlyEventIds());
  const publishedEvents=await db.event.findMany({
    where:{status:"PUBLISHED"},
    select:{id:true,slug:true,updatedAt:true},
  });
  const events=publishedEvents.filter((event)=>!directOnlyIds.has(event.id)&&!isTechnicalEventSlug(event.slug));

  let tours:TourSitemapRow[]=[];
  try{
    const allTours=await db.$queryRawUnsafe<TourSitemapRow[]>(`SELECT id,slug,updatedat FROM tour`);
    const nonIndexableIds=await getNonIndexableEventIds();
    const checked=await Promise.all(allTours.map(async(tour)=>{
      const links=await db.$queryRawUnsafe<TourEventRow[]>(`SELECT eventid FROM tourevent WHERE tourid=$1`,tour.id);
      if(!links.length)return null;
      const count=await db.event.count({where:{id:{in:links.map(link=>link.eventid),...(nonIndexableIds.length?{notIn:nonIndexableIds}:{})},status:"PUBLISHED"}});
      return count>0?tour:null;
    }));
    tours=checked.filter((tour):tour is TourSitemapRow=>tour!==null);
  }catch{
    tours=[];
  }

  const staticPages=["","/about","/faq","/careers","/contact","/privacy","/terms","/cancellation-policy"];
  const staticEntries:MetadataRoute.Sitemap=staticPages.map((path)=>({
    url:`${base}${path}`,
    changeFrequency:path===""?"daily":"monthly",
    priority:path===""?1:0.7,
  }));

  const eventEntries:MetadataRoute.Sitemap=events.map((event)=>({
    url:`${base}/events/${event.slug}`,
    lastModified:event.updatedAt,
    changeFrequency:"daily",
    priority:0.9,
  }));

  const tourEntries:MetadataRoute.Sitemap=tours.map((tour)=>({
    url:`${base}/tours/${tour.slug}`,
    lastModified:tour.updatedat?new Date(tour.updatedat):undefined,
    changeFrequency:"weekly",
    priority:0.85,
  }));

  return [...staticEntries,...tourEntries,...eventEntries];
}
