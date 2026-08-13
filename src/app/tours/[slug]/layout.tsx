import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCanonicalOrigin } from "@/lib/public-origin";
import { getDirectOnlyEventIds } from "@/lib/event-language-server";

type TourRow={id:string;slug:string;title:string;description:string;posterurl:string|null};
type TourEventRow={eventid:string};
type Props={children:React.ReactNode;params:Promise<{slug:string}>};

async function getTour(slug:string){
  try{
    const [tour]=await db.$queryRawUnsafe<TourRow[]>(`SELECT id,slug,title,description,posterurl FROM tour WHERE slug=$1 LIMIT 1`,slug);
    if(!tour)return undefined;
    const links=await db.$queryRawUnsafe<TourEventRow[]>(`SELECT eventid FROM tourevent WHERE tourid=$1`,tour.id);
    const directOnlyIds=await getDirectOnlyEventIds();
    const publicEventCount=links.length?await db.event.count({where:{id:{in:links.map(link=>link.eventid),...(directOnlyIds.length?{notIn:directOnlyIds}:{})},status:"PUBLISHED"}}):0;
    return {...tour,hasPublicEvents:publicEventCount>0};
  }catch{
    return undefined;
  }
}

export async function generateMetadata({params}:Pick<Props,"params">):Promise<Metadata>{
  const {slug}=await params;
  const tour=await getTour(slug);
  if(!tour)return {title:"Тур не найден",robots:{index:false,follow:false}};
  const url=`${getCanonicalOrigin()}/tours/${tour.slug}`;
  const description=tour.description.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,160);
  return {
    title:tour.title,
    description,
    alternates:{canonical:url},
    robots:tour.hasPublicEvents?undefined:{index:false,follow:true},
    openGraph:{type:"website",url,siteName:"Atlas One",title:tour.title,description,images:tour.posterurl?[{url:tour.posterurl,alt:tour.title}]:undefined},
    twitter:{card:"summary_large_image",title:tour.title,description,images:tour.posterurl?[tour.posterurl]:undefined},
  };
}

export default async function TourLayout({children,params}:Props){
  const {slug}=await params;
  const tour=await getTour(slug);
  if(!tour)notFound();
  if(!tour.hasPublicEvents)return children;
  const base=getCanonicalOrigin();
  const url=`${base}/tours/${tour.slug}`;
  const safeJson=(value:unknown)=>JSON.stringify(value).replace(/</g,"\\u003c");
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Atlas One",item:base},{"@type":"ListItem",position:2,name:tour.title,item:url}]};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(breadcrumb)}}/>{children}</>;
}
