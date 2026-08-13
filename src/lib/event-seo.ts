import { db } from "@/lib/db";

const transliteration: Record<string,string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  א:"a",ב:"b",ג:"g",ד:"d",ה:"h",ו:"v",ז:"z",ח:"h",ט:"t",י:"y",כ:"k",ך:"k",ל:"l",מ:"m",ם:"m",נ:"n",ן:"n",ס:"s",ע:"a",פ:"p",ף:"p",צ:"ts",ץ:"ts",ק:"k",ר:"r",ש:"sh",ת:"t",
};

export function slugifyEventText(value:string){
  const normalized=value.normalize("NFKD").toLowerCase();
  let ascii="";
  for(const char of normalized){
    if(/[a-z0-9]/.test(char))ascii+=char;
    else if(transliteration[char]!==undefined)ascii+=transliteration[char];
    else ascii+="-";
  }
  return ascii.replace(/-+/g,"-").replace(/^-|-$/g,"");
}

function israelDateKey(value:Date){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Jerusalem",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const part=(type:"year"|"month"|"day")=>parts.find(item=>item.type===type)?.value??"";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function buildEventSeoSlug(title:string,city:string,startsAt:Date){
  const date=israelDateKey(startsAt);
  const titlePart=slugifyEventText(title)||"event";
  const cityPart=slugifyEventText(city);
  return [titlePart,cityPart,date].filter(Boolean).join("-").slice(0,110).replace(/-$/g,"");
}

export function isTechnicalEventSlug(slug:string){
  return /^draft-[a-z0-9]+$/i.test(slug);
}

export async function ensureEventSeoSlug(eventId:string){
  const event=await db.event.findUnique({where:{id:eventId},include:{venue:true}});
  if(!event||!isTechnicalEventSlug(event.slug))return event?.slug??null;

  const base=buildEventSeoSlug(event.title,event.venue.city,event.startsAt);
  let candidate=base;
  for(let suffix=2;suffix<100;suffix++){
    const existing=await db.event.findUnique({where:{slug:candidate},select:{id:true}});
    if(!existing||existing.id===eventId){
      await db.event.update({where:{id:eventId},data:{slug:candidate}});
      return candidate;
    }
    candidate=`${base.slice(0,105)}-${suffix}`;
  }
  throw new Error("Unable to generate a unique public event slug");
}
