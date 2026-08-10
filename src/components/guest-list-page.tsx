"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestFieldConfig, GuestFieldKey } from "@/lib/event-guest-fields";

type Guest={id:string;name:string;phone:string;ticketStatus:string};
type ActionResponse={error?:string;emailQueued?:boolean;publicId?:string};
const labels:Record<GuestFieldKey,string>={firstName:"Имя",lastName:"Фамилия",phone:"Телефон",email:"Email",birthDate:"Дата рождения",city:"Город проживания",facebook:"Facebook",instagram:"Instagram"};
const types:Partial<Record<GuestFieldKey,string>>={email:"email",birthDate:"date",phone:"tel"};

export function GuestListPage({code,token,title,eventTitle,allocation,limit,guestCount,guests,canManage,fields}:{code:string;token:string;title:string;eventTitle:string;allocation:string;limit:number;guestCount:number;guests:Guest[];canManage:boolean;fields:GuestFieldConfig}){
  const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[success,setSuccess]=useState("");
  useEffect(()=>{const key=`atlas-guest-session-${code}`;let sessionId=localStorage.getItem(key);if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(key,sessionId);}void fetch(`/api/guest-lists/${code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"visit",sessionId})}).catch(()=>undefined);},[code]);
  async function send(body:Record<string,unknown>){
    setBusy(true);setError("");setSuccess("");
    try{
      const response=await fetch(`/api/guest-lists/${code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const raw=await response.text();let data:ActionResponse={};try{data=raw?JSON.parse(raw):{};}catch{}
      if(!response.ok){setError(data.error||`Не удалось выполнить действие (${response.status})`);return false;}
      if(body.action==="add")setSuccess(`Гость добавлен. Билет ${data.publicId||""} создан, письмо поставлено в отправку.`);
      else setSuccess("Гость удалён");
      router.refresh();return true;
    }catch{
      setError("Сервер не ответил. Проверьте соединение и попробуйте ещё раз.");return false;
    }finally{setBusy(false);}
  }
  const configured=(Object.keys(fields) as GuestFieldKey[]).filter(key=>fields[key].visible);
  const visible=configured.includes("email")?configured:[...configured,"email" as GuestFieldKey];
  return <main className="shell"><section className="panel" style={{maxWidth:720,margin:"28px auto"}}><span className="eyebrow">ATLAS GUEST LIST</span><h1>{title}</h1><p><strong>{eventTitle}</strong><br/><span className="muted">{allocation}</span></p><div className="stats"><div className="stat"><span className="muted">Записано</span><strong>{guestCount}</strong></div><div className="stat"><span className="muted">Осталось</span><strong>{Math.max(0,limit-guestCount)}</strong></div></div>
    {canManage&&guestCount<limit&&<form className="form panel" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const customer={...Object.fromEntries(visible.map(key=>[key,String(f.get(key)||"")])),gender:String(f.get("gender")||"")};const ok=await send({action:"add",token,customer});if(ok)form.reset();}}><h2>Добавить гостя</h2><p className="muted">Atlas сразу создаст заказ и билет. Письмо с PDF будет отправлено в фоне на указанный email.</p>{visible.map(key=>{const required=key==="email"||fields[key]?.required;return <div className="field" key={key}><label>{labels[key]}{required?" *":" — необязательно"}</label><input className="input" name={key} type={types[key]||"text"} required={required} disabled={busy} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":key==="phone"?"tel":key==="email"?"email":"off"}/></div>;})}<div className="field"><label>Пол *</label><select className="input" name="gender" required disabled={busy} defaultValue=""><option value="" disabled>Выберите пол</option><option value="MALE">Мужчина</option><option value="FEMALE">Женщина</option></select></div>{fields.birthDate.visible&&<p className="muted">Возраст будет рассчитан автоматически по дате рождения.</p>}{error&&<div className="toast" role="alert">{error}</div>}{success&&<div className="toast" role="status">{success}</div>}<button className="btn" disabled={busy}>{busy?"Создаём билет...":"Добавить гостя и создать билет"}</button></form>}
    {canManage?<><h2 className="section-title">Список гостей</h2><div className="table-wrap"><table><thead><tr><th>Гость</th><th>Телефон</th><th>Статус</th><th/></tr></thead><tbody>{guests.map(guest=><tr key={guest.id}><td><strong>{guest.name}</strong></td><td>{guest.phone}</td><td><span className="pill">{guest.ticketStatus==="USED"?"Прошёл":"Билет выдан"}</span></td><td><button type="button" className="btn secondary" disabled={busy||guest.ticketStatus==="USED"} onClick={()=>void send({action:"remove",token,orderId:guest.id})}>Удалить</button></td></tr>)}{!guests.length&&<tr><td colSpan={4}>Пока никто не записан.</td></tr>}</tbody></table></div></>:<p className="muted">Персональные данные гостей скрыты. Просмотр и управление списком доступны только по защищённой ссылке организатора.</p>}
  </section></main>;
}
