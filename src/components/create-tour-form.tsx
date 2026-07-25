"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EventOption={id:string;title:string;city:string;startsAt:string};

export function CreateTourForm({events}:{events:EventOption[]}){
  const router=useRouter();
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");
    const form=new FormData(e.currentTarget);
    const response=await fetch("/api/admin/tours",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:form.get("title"),slug:form.get("slug"),description:form.get("description"),posterUrl:form.get("posterUrl"),eventIds:selected})});
    const data=await response.json();
    if(!response.ok){setError(data.error||"Не удалось создать тур");setBusy(false);return;}
    router.push(`/tours/${data.slug}`);router.refresh();
  }
  return <form className={`panel form ${busy?"loading":""}`} onSubmit={submit}>
    <div className="field"><label>Название тура</label><input className="input" name="title" required placeholder="NOA ELECTRIC — Israel Tour 2026"/></div>
    <div className="field"><label>Адрес страницы</label><input className="input" name="slug" required pattern="[a-z0-9-]+" placeholder="noa-electric-israel-2026"/></div>
    <div className="field"><label>Общее описание</label><textarea name="description" rows={5} required/></div>
    <div className="field"><label>Общая афиша — HTTPS-ссылка</label><input className="input" name="posterUrl" type="url" placeholder="https://..."/></div>
    <div className="field"><label>Выступления тура</label><div className="tour-event-picker">{events.map(event=><label key={event.id} className={selected.includes(event.id)?"selected":""}><input type="checkbox" checked={selected.includes(event.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,event.id]:current.filter(id=>id!==event.id))}/><span><strong>{event.title}</strong><small>{event.city} · {new Date(event.startsAt).toLocaleString("ru-IL")}</small></span></label>)}</div></div>
    {error&&<div className="toast">{error}</div>}
    <button className="btn" disabled={busy||selected.length<2}>{busy?"Создаём...":"Создать страницу тура"}</button>
    <p className="muted">Для тура нужно выбрать минимум два существующих мероприятия. Цены, площадки, схемы и остатки остаются отдельными для каждой даты.</p>
  </form>;
}
