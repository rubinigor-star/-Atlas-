"use client";

import { useState } from "react";
import { CreateEventForm } from "@/components/create-event-form";
import { CloneEventForm } from "@/components/clone-event-form";

type SourceEvent={id:string;title:string;startsAt:string;venueName:string;city:string;address:string};
type Mode="create"|"clone"|null;

export function NewEventWorkflow({events}:{events:SourceEvent[]}){
 const[mode,setMode]=useState<Mode>(null);
 if(!mode)return <div className="panel form"><div className="wizard-heading"><span>01</span><div><h2>Как создать мероприятие?</h2><p>Выберите способ один раз. После перехода к редактору этот выбор больше не показывается.</p></div></div><div className="choice-grid"><button type="button" className="choice-card" onClick={()=>setMode("create")}><i>＋</i><strong>Создать с нуля</strong><small>Заполнить данные, продажи и оформление заказа.</small></button><button type="button" className="choice-card" onClick={()=>setMode("clone")}><i>⧉</i><strong>Скопировать существующее</strong><small>Выбрать исходное мероприятие и параметры копирования.</small></button></div></div>;
 return <div><button type="button" className="btn secondary" style={{marginBottom:16}} onClick={()=>setMode(null)}>← Изменить способ создания</button>{mode==="create"?<CreateEventForm/>:<CloneEventForm events={events}/>}</div>;
}
