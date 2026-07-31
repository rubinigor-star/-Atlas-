"use client";

import { useState } from "react";

type EventOption={id:string;title:string;startsAt:string;status:string;organization:string};

export function MarqueeEditor({available,initialSelected}:{available:EventOption[];initialSelected:string[]}){
  const[selected,setSelected]=useState(initialSelected);
  const[saving,setSaving]=useState(false);
  const[message,setMessage]=useState("");
  const selectedSet=new Set(selected);
  const move=(index:number,direction:-1|1)=>{const next=[...selected];const target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];setSelected(next);};
  const save=async()=>{setSaving(true);setMessage("");try{const response=await fetch("/api/platform/homepage/marquee",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({eventIds:selected})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Не удалось сохранить");setMessage("Бегущая строка сохранена.");}catch(error){setMessage(error instanceof Error?error.message:"Ошибка сохранения");}finally{setSaving(false);}};
  const byId=new Map(available.map(event=>[event.id,event]));
  return <div className="form-grid two" style={{alignItems:"start"}}>
    <section className="panel"><h2>Доступные мероприятия</h2><p className="muted">Можно добавить только опубликованные мероприятия.</p><div style={{display:"grid",gap:10}}>{available.filter(event=>!selectedSet.has(event.id)).map(event=><div className="row between" key={event.id}><div><strong>{event.title}</strong><br/><small>{event.organization} · {new Date(event.startsAt).toLocaleDateString("ru-IL",{timeZone:"Asia/Jerusalem"})}</small></div><button className="btn secondary" type="button" onClick={()=>setSelected([...selected,event.id])}>Добавить</button></div>)}{available.every(event=>selectedSet.has(event.id))&&<p className="muted">Все опубликованные мероприятия уже добавлены.</p>}</div></section>
    <section className="panel"><div className="row between"><div><h2 style={{marginBottom:4}}>Показываются на главной</h2><p className="muted" style={{margin:0}}>Порядок сверху вниз соответствует порядку в строке.</p></div><button className="btn" type="button" disabled={saving} onClick={save}>{saving?"Сохраняем...":"Сохранить"}</button></div>{message&&<div className="toast" style={{marginTop:12}}>{message}</div>}<div style={{display:"grid",gap:10,marginTop:16}}>{selected.map((id,index)=>{const event=byId.get(id);if(!event)return null;return <div className="row between" key={id}><div><strong>{index+1}. {event.title}</strong><br/><small>{event.organization}</small></div><div className="row" style={{gap:6}}><button className="btn secondary" type="button" disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button className="btn secondary" type="button" disabled={index===selected.length-1} onClick={()=>move(index,1)}>↓</button><button className="btn secondary" type="button" onClick={()=>setSelected(selected.filter(item=>item!==id))}>Убрать</button></div></div>})}{selected.length===0&&<p className="muted">Список пуст. Бегущая строка на главной будет скрыта.</p>}</div></section>
  </div>;
}
