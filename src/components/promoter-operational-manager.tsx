"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Assignment={id:string;eventId:string;eventTitle:string;eventStatus:string;shareUrl:string;emailStatus:string;sentAt:string|null;active:boolean};
type EventOption={id:string;title:string};

export function PromoterOperationalManager({promoterId,email,autoAssignAllEvents,events,assignments}:{promoterId:string;email:string|null;autoAssignAllEvents:boolean;events:EventOption[];assignments:Assignment[]}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[copied,setCopied]=useState<string|null>(null);const[eventId,setEventId]=useState(events.find(e=>!assignments.some(a=>a.eventId===e.id))?.id||"");
 async function post(payload:unknown){setBusy(true);setError("");const r=await fetch("/api/admin/promoters",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const data=await r.json();setBusy(false);if(!r.ok){setError(data.error||"Ошибка");return false}router.refresh();return true}
 async function copy(url:string,id:string){await navigator.clipboard.writeText(url);setCopied(id);window.setTimeout(()=>setCopied(null),1400)}
 const available=events.filter(e=>!assignments.some(a=>a.eventId===e.id));
 return <div style={{display:"grid",gap:20}}>
  <div className="panel"><span className="eyebrow">Автоматизация</span><h2 style={{marginBottom:8}}>Как назначать промоутера</h2><label className="row" style={{gap:10,alignItems:"flex-start"}}><input type="checkbox" checked={autoAssignAllEvents} disabled={busy} onChange={e=>void post({action:"automation",promoterId,autoAssignAllEvents:e.target.checked})}/><span><strong>Автоматически добавлять ко всем новым мероприятиям</strong><br/><small className="muted">При публикации Atlas создаст персональную ссылку и отправит её на {email||"email промоутера"}.</small></span></label></div>
  <div className="panel"><div className="row between"><div><span className="eyebrow">Мероприятия</span><h2 style={{marginBottom:4}}>Назначения промоутера</h2></div><span className="pill">{assignments.length} назначено</span></div>
   {available.length>0&&<div className="row" style={{gap:10,marginTop:16,alignItems:"end",flexWrap:"wrap"}}><div className="field" style={{margin:0,minWidth:280}}><label>Добавить мероприятие</label><select value={eventId} onChange={e=>setEventId(e.target.value)}>{available.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></div><button className="btn dark" disabled={busy||!eventId} onClick={()=>void post({action:"assignEvent",promoterId,eventId})}>Назначить и создать ссылку</button></div>}
   {!email&&<div className="toast" style={{marginTop:14}}>У промоутера нет email. Ссылку можно создать, но автоматическая отправка невозможна.</div>}{error&&<div className="toast" style={{marginTop:14}}>{error}</div>}
   <div className="table-wrap" style={{marginTop:18}}><table><thead><tr><th>Мероприятие</th><th>Персональная ссылка</th><th>Email</th><th>Действия</th></tr></thead><tbody>{assignments.map(a=><tr key={a.id}><td><strong>{a.eventTitle}</strong><br/><small>{a.eventStatus==="PUBLISHED"?"Опубликовано":"Черновик"}</small></td><td><code style={{wordBreak:"break-all"}}>{a.shareUrl}</code></td><td>{a.emailStatus==="SENT"?<><strong style={{color:"#067647"}}>Отправлено</strong>{a.sentAt&&<><br/><small>{new Date(a.sentAt).toLocaleString("ru-RU")}</small></>}</>:a.eventStatus!=="PUBLISHED"?<span className="muted">После публикации</span>:a.emailStatus==="ERROR"?<strong style={{color:"#b42318"}}>Ошибка отправки</strong>:<span className="muted">Не отправлено</span>}</td><td><div className="row" style={{gap:6,flexWrap:"wrap"}}><button className="btn" type="button" onClick={()=>void copy(a.shareUrl,a.id)}>{copied===a.id?"Скопировано":"Копировать"}</button>{a.eventStatus==="PUBLISHED"&&email&&<button className="btn" type="button" disabled={busy} onClick={()=>void post({action:"resendEmail",linkId:a.id})}>Отправить повторно</button>}</div></td></tr>)}{!assignments.length&&<tr><td colSpan={4}>Промоутер пока не назначен ни на одно мероприятие.</td></tr>}</tbody></table></div>
  </div>
 </div>;
}
