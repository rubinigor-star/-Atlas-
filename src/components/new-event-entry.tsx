"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloneEventForm } from "@/components/clone-event-form";

type SourceEvent={id:string;title:string;startsAt:string;venueName:string;city:string;address:string};

export function NewEventEntry({events}:{events:SourceEvent[]}){
 const router=useRouter();const[mode,setMode]=useState<""|"new"|"copy">("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");
 async function create(){setMode("new");setBusy(true);setError("");const response=await fetch("/api/admin/events/draft",{method:"POST"});const data=await response.json().catch(()=>({}));if(!response.ok){setError(data.error||"Не удалось создать черновик");setBusy(false);return}router.push(`/office/events/${data.id}?tab=about&setup=1`);router.refresh()}
 if(mode==="copy")return <div><button type="button" className="btn dark" onClick={()=>setMode("")}>← Назад к выбору</button><div style={{marginTop:18}}><CloneEventForm events={events}/></div></div>;
 return <div className="panel form"><span className="eyebrow">Начало работы</span><h2>Как создать мероприятие?</h2><p className="muted">В обоих случаях откроется один и тот же редактор с четырьмя разделами. Копия не публикуется автоматически.</p><div className="choice-grid"><button type="button" className="choice-card" onClick={()=>void create()} disabled={busy}><i>＋</i><strong>{busy?"Открываем редактор…":"Создать с нуля"}</strong><small>Atlas создаст технический черновик и сразу откроет полную настройку, включая карту.</small></button><button type="button" className="choice-card" onClick={()=>setMode("copy")}><i>⧉</i><strong>Скопировать существующее</strong><small>Скопировать данные, затем пройти все вкладки и изменить нужные настройки.</small></button></div>{error&&<div className="toast">{error}</div>}</div>;
}
