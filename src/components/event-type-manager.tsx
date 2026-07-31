"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { eventTypeLabels,eventTypeValues,type EventType } from "@/lib/event-type";
import styles from "./event-type-manager.module.css";

const icons:Record<EventType,string>={
 SOLO_CONCERT:"🎤",
 LIVE_MUSIC:"🎸",
 CLASSICAL_CONCERT:"🎻",
 FESTIVAL:"🎪",
 PARTY:"✨",
 DJ_SET:"🎧",
 THEATRE:"🎭",
 COMEDY:"🎙️",
 CHILDREN_SHOW:"🧸",
 SPORT:"🏆",
 LECTURE:"💡",
 CONFERENCE:"👥",
 EXHIBITION:"🖼️",
 WORKSHOP:"🛠️",
 OTHER:"✦",
};

export function EventTypeManager({eventId,initialTypes}:{eventId:string;initialTypes:EventType[]}){
 const router=useRouter();const{locale}=useLocale();const[types,setTypes]=useState<EventType[]>(initialTypes);const[message,setMessage]=useState("");
 function toggle(value:EventType){setTypes(current=>current.includes(value)?(current.length===1?current:current.filter(item=>item!==value)):[...current,value])}
 async function save(){setMessage("");const response=await fetch(`/api/admin/events/${eventId}/types`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({eventTypes:types})});const data=await response.json().catch(()=>({}));setMessage(response.ok?"✓ Типы мероприятия сохранены":data.error||"Не удалось сохранить");if(response.ok)router.refresh()}
 return <section className={`panel ${styles.panel}`}>
  <div className={styles.header}><span className="eyebrow">Классификация</span><h2>Тип мероприятия</h2><p className="muted">Выберите один или несколько вариантов, чтобы мероприятие отображалось в подходящих фильтрах.</p></div>
  <div className={styles.options}>{eventTypeValues.map(value=>{const selected=types.includes(value);return <button key={value} type="button" className={`${styles.option} ${selected?styles.selected:""}`} onClick={()=>toggle(value)} aria-pressed={selected}><span className={styles.icon} aria-hidden="true">{icons[value]}</span><span className={styles.label}>{eventTypeLabels[locale][value]}</span><span className={styles.check} aria-hidden="true">✓</span></button>})}</div>
  <div className={styles.footer}><button type="button" className="btn" onClick={()=>void save()}>Сохранить типы</button>{message&&<span className="muted" role="status">{message}</span>}</div>
 </section>;
}
