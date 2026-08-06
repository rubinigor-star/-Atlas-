"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { eventTypeLabels,eventTypeValues,type EventType } from "@/lib/event-type";
import styles from "./event-type-manager.module.css";

const copy={
 ru:{eyebrow:"Классификация",title:"Тип мероприятия",help:"Выберите один или несколько вариантов, чтобы мероприятие отображалось в подходящих фильтрах.",save:"Сохранить типы",saved:"✓ Типы мероприятия сохранены",error:"Не удалось сохранить"},
 he:{eyebrow:"סיווג",title:"סוג האירוע",help:"בחרו אפשרות אחת או יותר כדי שהאירוע יוצג במסננים המתאימים.",save:"שמירת סוגי האירוע",saved:"✓ סוגי האירוע נשמרו",error:"לא ניתן לשמור"},
 en:{eyebrow:"Classification",title:"Event type",help:"Choose one or more options so the event appears in the appropriate filters.",save:"Save event types",saved:"✓ Event types saved",error:"Could not save"}
} as const;

export function EventTypeManager({eventId,initialTypes}:{eventId:string;initialTypes:EventType[]}){
 const router=useRouter();const{locale}=useLocale();const text=copy[locale];const[types,setTypes]=useState<EventType[]>(initialTypes);const[message,setMessage]=useState("");const[mountTarget,setMountTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>{const infoPanel=document.querySelector<HTMLElement>('form[data-unified-save="about"] [class*="infoPanelSection"]');if(!infoPanel)return;const mount=document.createElement("div");mount.dataset.eventTypeMount="true";infoPanel.insertAdjacentElement("afterend",mount);setMountTarget(mount);return()=>mount.remove();},[]);
 function toggle(value:EventType){setTypes(current=>current.includes(value)?(current.length===1?current:current.filter(item=>item!==value)):[...current,value])}
 async function save(){setMessage("");const response=await fetch(`/api/admin/events/${eventId}/types`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({eventTypes:types})});const data=await response.json().catch(()=>({}));setMessage(response.ok?text.saved:data.error||text.error);if(response.ok)router.refresh()}
 const content=<section className={styles.panel} data-event-type-manager="true">
  <div className={styles.header}><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p className="muted">{text.help}</p></div>
  <div className={styles.options}>{eventTypeValues.map(value=>{const selected=types.includes(value);return <button key={value} type="button" className={`${styles.option} ${selected?styles.selected:""}`} onClick={()=>toggle(value)} aria-pressed={selected}><span className={styles.label}>{eventTypeLabels[locale][value]}</span><span className={styles.check} aria-hidden="true">✓</span></button>})}</div>
  <div className={styles.footer}><button type="button" className="btn" data-workspace-local-save="true" onClick={()=>void save()}>{text.save}</button>{message&&<span className="muted" role="status">{message}</span>}</div>
 </section>;
 return mountTarget?createPortal(content,mountTarget):null;
}
