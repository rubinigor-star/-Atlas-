"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { eventTypeLabels,eventTypeValues,type EventType } from "@/lib/event-type";

export function EventTypeManager({eventId,initialTypes}:{eventId:string;initialTypes:EventType[]}){
 const router=useRouter();const{locale}=useLocale();const[types,setTypes]=useState<EventType[]>(initialTypes);const[message,setMessage]=useState("");
 function toggle(value:EventType){setTypes(current=>current.includes(value)?(current.length===1?current:current.filter(item=>item!==value)):[...current,value])}
 async function save(){setMessage("");const response=await fetch(`/api/admin/events/${eventId}/types`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({eventTypes:types})});const data=await response.json().catch(()=>({}));setMessage(response.ok?"✓ Типы мероприятия сохранены":data.error||"Не удалось сохранить");if(response.ok)router.refresh()}
 return <section className="panel form"><span className="eyebrow">Classification</span><h2>Тип мероприятия</h2><p className="muted">Можно выбрать несколько вариантов. Мероприятие будет найдено в каждом соответствующем фильтре.</p><div className="choice-grid">{eventTypeValues.map(value=><button key={value} type="button" className={`choice-card ${types.includes(value)?"selected":""}`} onClick={()=>toggle(value)}><strong>{eventTypeLabels[locale][value]}</strong><small>{types.includes(value)?"Выбрано":"Добавить категорию"}</small></button>)}</div><div className="row"><button type="button" className="btn" onClick={()=>void save()}>Сохранить типы</button>{message&&<span className="muted" role="status">{message}</span>}</div></section>;
}
