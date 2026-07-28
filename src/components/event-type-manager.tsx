"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { eventTypeLabels,eventTypeValues,type EventType } from "@/lib/event-type";

const headings={ru:{title:"Тип мероприятия",help:"Выбранный тип отображается на карточке и публичной странице мероприятия.",save:"Сохранить тип",saved:"✓ Тип мероприятия сохранён",error:"Не удалось сохранить"},he:{title:"סוג האירוע",help:"הסוג הנבחר יוצג בכרטיס ובעמוד האירוע הציבורי.",save:"שמירת סוג",saved:"✓ סוג האירוע נשמר",error:"לא ניתן לשמור"},en:{title:"Event type",help:"The selected type appears on the event card and public event page.",save:"Save event type",saved:"✓ Event type saved",error:"Could not save"}} as const;

export function EventTypeManager({eventId,initialType}:{eventId:string;initialType:EventType}){
 const router=useRouter();const{locale}=useLocale();const text=headings[locale];const[type,setType]=useState<EventType>(initialType);const[message,setMessage]=useState("");
 async function save(){setMessage("");try{const response=await fetch(`/api/admin/events/${eventId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"event-type",eventType:type})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||text.error);setMessage(text.saved);router.refresh();window.setTimeout(()=>setMessage(""),2500);}catch(error){setMessage(error instanceof Error?error.message:text.error);}}
 return <section className="panel form"><span className="eyebrow">Classification</span><h2>{text.title}</h2><p className="muted">{text.help}</p><div className="field"><select value={type} onChange={event=>setType(event.target.value as EventType)}>{eventTypeValues.map(value=><option key={value} value={value}>{eventTypeLabels[locale][value]}</option>)}</select></div><div className="row"><button type="button" className="btn" onClick={()=>void save()}>{text.save}</button>{message&&<span className="muted" role="status">{message}</span>}</div></section>;
}
