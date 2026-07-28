import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

const BASE="https://www.atlas-one.co";
type TourRow={slug:string;title:string;description:string;posterurl:string|null};
type Props={children:React.ReactNode;params:Promise<{slug:string}>};

async function getTour(slug:string){
  try{
    const [tour]=await db.$queryRawUnsafe<TourRow[]>(`SELECT slug,title,description,posterurl FROM tour WHERE slug=$1 LIMIT 1`,slug);
    return tour;
  }catch{
    return undefined;
  }
}

export async function generateMetadata({params}:Pick<Props,"params">):Promise<Metadata>{
  const {slug}=await params;
  const tour=await getTour(slug);
  if(!tour)return {title:"Тур не найден",robots:{index:false,follow:false}};
  const url=`${BASE}/tours/${tour.slug}`;
  const description=tour.description.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,160);
  return {
    title:tour.title,
    description,
    alternates:{canonical:url},
    openGraph:{type:"website",url,siteName:"Atlas One",title:tour.title,description,images:tour.posterurl?[{url:tour.posterurl,alt:tour.title}]:undefined},
    twitter:{card:"summary_large_image",title:tour.title,description,images:tour.posterurl?[tour.posterurl]:undefined},
  };
}

export default async function TourLayout({children,params}:Props){
  const {slug}=await params;
  const tour=await getTour(slug);
  if(!tour)notFound();
  return children;
}
