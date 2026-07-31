"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestFieldConfig, GuestFieldKey } from "@/lib/event-guest-fields";

type Guest={id:string;name:string;phone:string;ticketStatus:string};
const labels:Record<GuestFieldKey,string>={firstName:"Имя",lastName:"Фамилия",phone:"Телефон",email:"Email",birthDate:"Дата рождения",city:"Город проживания",facebook:"Facebook",instagram:"Instagram"};
const types:Partial<Record<GuestFieldKey,string>>={email:"email",birthDate:"date",phone:"tel"};

export function GuestListPage({code,token,title,eventTitle,allocation,limit,guests,canManage,fields}:{code:string;token:string;title:string;eventTitle:string;allocation:string;limit:number;guests:Guest[];canManage:boolean;fields:GuestFieldConfig}){
  const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[success,setSuccess]=useState("");
  useEffect(()=>{const key=`atlas-guest-session-${code}`;let sessionId=localStorage.getItem(key);if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(key,sessionId);}void fetch(`/api/guest-lists/${code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"visit",sessionId})}).catch(()=>undefined);},[code]);
  async function send(body:Record<string,unknown>){
    setBusy(true);setError("");setSuccess("");
    try{
      const response=await fetch(`/api/guest-lists/${code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const raw=await response.text();let data:{error?:string}={};try{data=raw?JSON.parse(raw):{};}catch{}
      if(!response.ok){setError(data.error||`Не удалось выполнить действие (${response.status})`);return false;}
      setSuccess(body.action==="add"?"Гость добавлен, билет выдан":"Гость удалён");
      router.refresh();return true;
    }catch{
      setError("Сервер не ответил. Проверьте соединение и попробуйте ещё раз.");return false;
    }finally{setBusy(false);}
  }
  const visible=(Object.keys(fields) as GuestFieldKey[]).filter(key=>fields[key].visible);
  return <main className="shell"><section className="panel" style={{maxWidth:720,margin:"28px auto"}}><span className="eyebrow">ATLAS GUEST LIST</span><h1>{title}</h1><p><strong>{eventTitle}</strong><br/><span className="muted">{allocation}</span></p><div className="stats"><div className="stat"><span className="muted">Записано</span><strong>{guests.length}</strong></div><div className="stat"><span className="muted">Осталось</span><strong>{Math.max(0,limit-guests.length)}</strong></div></div>
    {canManage&&guests.length<limit&&<form className="form panel" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const customer=Object.fromEntries(visible.map(key=>[key,String(f.get(key)||"")]));const ok=await send({action:"add",token,customer});if(ok)form.reset();}}><h2>Добавить гостя</h2>{visible.map(key=><div className="field" key={key}><label>{labels[key]}{fields[key].required?" *":" — необязательно"}</label><input className="input" name={key} type={types[key]||"text"} required={fields[key].required} disabled={busy} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":key==="phone"?"tel":key==="email"?"email":"off"}/></div>)}{fields.birthDate.visible&&<p className="muted">Возраст будет рассчитан автоматически по дате рождения.</p>}{error&&<div className="toast" role="alert">{error}</div>}{success&&<div className="toast" role="status">{success}</div>}<button className="btn" disabled={busy}>{busy?"Добавляем...":"Добавить и выдать билет"}</button></form>}
    <h2 className="section-title">Список гостей</h2><div className="table-wrap"><table><thead><tr><th>Гость</th><th>Телефон</th><th>Статус</th>{canManage&&<th/>}</tr></thead><tbody>{guests.map(guest=><tr key={guest.id}><td><strong>{guest.name}</strong></td><td>{guest.phone}</td><td><span className="pill">{guest.ticketStatus==="USED"?"Прошёл":"Билет выдан"}</span></td>{canManage&&<td><button type="button" className="btn secondary" disabled={busy||guest.ticketStatus==="USED"} onClick={()=>void send({action:"remove",token,orderId:guest.id})}>Удалить</button></td>}</tr>)}{!guests.length&&<tr><td colSpan={canManage?4:3}>Пока никто не записан.</td></tr>}</tbody></table></div>{!canManage&&<p className="muted">Это публичный просмотр списка. Добавлять и удалять гостей можно только по защищённой ссылке управления.</p>}</section></main>;
}
