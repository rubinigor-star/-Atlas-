"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import type { GuestFieldConfig, GuestFieldKey } from "@/lib/event-guest-fields";

type Guest={id:string;name:string;phone:string|null;ticketStatus:string};
type ActionResponse={error?:string;emailQueued?:boolean;publicId?:string;status?:string;paymentUrl?:string};
const labels:Record<GuestFieldKey,string>={firstName:"Имя",lastName:"Фамилия",phone:"Телефон",email:"Email",birthDate:"Дата рождения",city:"Город проживания",facebook:"Facebook",instagram:"Instagram"};
const types:Partial<Record<GuestFieldKey,string>>={email:"email",birthDate:"date",phone:"tel"};
const SESSION_TTL_MS=30*60*1000;

function sessionFor(key:string){const now=Date.now();try{const raw=localStorage.getItem(key);if(raw){const parsed=JSON.parse(raw) as {id?:unknown;lastSeen?:unknown};if(typeof parsed.id==="string"&&typeof parsed.lastSeen==="number"&&now-parsed.lastSeen<SESSION_TTL_MS){localStorage.setItem(key,JSON.stringify({id:parsed.id,lastSeen:now}));return parsed.id;}}}catch{}const id=crypto.randomUUID();localStorage.setItem(key,JSON.stringify({id,lastSeen:now}));return id;}

export function GuestListPage({code,token,title,eventTitle,eventId,categoryId,tableId,requiresPayment,allocation,limit,guestCount,guests,canManage,showAttendees,fields}:{code:string;token:string;title:string;eventTitle:string;eventId:string;categoryId:string|null;tableId:string|null;requiresPayment:boolean;allocation:string;limit:number;guestCount:number;guests:Guest[];canManage:boolean;showAttendees:boolean;fields:GuestFieldConfig}){
  const router=useRouter();const{locale}=useLocale();const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[success,setSuccess]=useState("");
  useEffect(()=>{const sessionId=sessionFor(`atlas-guest-session-${code}`);void fetch(`/api/guest-lists/${code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"visit",sessionId})}).catch(()=>undefined);},[code]);
  async function send(body:Record<string,unknown>){
    setBusy(true);setError("");setSuccess("");
    try{
      const response=await fetch(`/api/guest-lists/${code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const raw=await response.text();let data:ActionResponse={};try{data=raw?JSON.parse(raw):{};}catch{}
      if(!response.ok){setError(data.error||`Не удалось выполнить действие (${response.status})`);return false;}
      if(body.action==="add")setSuccess(data.status==="PENDING_APPROVAL"?"Заявка отправлена организатору на подтверждение.":`Регистрация подтверждена. Билет ${data.publicId||""} создан и будет отправлен на email.`);
      else setSuccess("Гость удалён");
      router.refresh();return true;
    }catch{
      setError("Сервер не ответил. Проверьте соединение и попробуйте ещё раз.");return false;
    }finally{setBusy(false);}
  }
  async function register(customer:Record<string,string>){
    if(!requiresPayment)return send({action:"add",customer});
    if(!categoryId){setError("Для этой ссылки не назначена категория билета.");return false;}
    setBusy(true);setError("");setSuccess("");
    try{
      const response=await fetch("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId,categoryId,quantity:1,tableId:null,customer,payment:{method:"CARD"},locale,referralCode:code,idempotencyKey:crypto.randomUUID()})});
      const raw=await response.text();let data:ActionResponse={};try{data=raw?JSON.parse(raw):{};}catch{}
      if(!response.ok){setError(data.error||`Не удалось начать оплату (${response.status})`);return false;}
      if(!data.paymentUrl){setError("Платёжная страница не была создана.");return false;}
      window.location.assign(data.paymentUrl);return true;
    }catch{
      setError("Не удалось открыть оплату. Проверьте соединение и попробуйте ещё раз.");return false;
    }finally{setBusy(false);}
  }
  const configured=(Object.keys(fields) as GuestFieldKey[]).filter(key=>fields[key].visible);
  const visible=configured.includes("email")?configured:[...configured,"email" as GuestFieldKey];
  const showRoster=canManage||showAttendees;
  const hasCapacity=guestCount<limit;
  return <main className="shell"><section className="panel" style={{maxWidth:720,margin:"28px auto"}}><span className="eyebrow">ATLAS GUEST LIST</span><h1>{title}</h1><p><strong>{eventTitle}</strong><br/><span className="muted">{allocation}</span></p>
    {showRoster&&<div className="stats"><div className="stat"><span className="muted">Записано</span><strong>{guestCount}</strong></div><div className="stat"><span className="muted">Осталось</span><strong>{Math.max(0,limit-guestCount)}</strong></div></div>}
    {hasCapacity?<form className="form panel" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const customer={...Object.fromEntries(visible.map(key=>[key,String(f.get(key)||"")])),gender:String(f.get("gender")||"")};const ok=await register(customer);if(ok&&!requiresPayment)form.reset();}}><h2>Записаться</h2><p className="muted">Заполните данные. {requiresPayment?"После этого откроется безопасная оплата. Если мероприятие требует подтверждения, после авторизации заявка поступит организатору.":"Если мероприятие требует подтверждения, заявка сначала поступит организатору. В автоматическом режиме билет будет создан сразу."}</p>{visible.map(key=>{const required=key==="email"||fields[key]?.required;return <div className="field" key={key}><label>{labels[key]}{required?" *":" - необязательно"}</label><input className="input" name={key} type={types[key]||"text"} required={required} disabled={busy} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":key==="phone"?"tel":key==="email"?"email":"off"}/></div>;})}<div className="field"><label>Пол *</label><select className="input" name="gender" required disabled={busy} defaultValue=""><option value="" disabled>Выберите пол</option><option value="MALE">Мужчина</option><option value="FEMALE">Женщина</option></select></div>{fields.birthDate.visible&&<p className="muted">Возраст будет рассчитан автоматически по дате рождения.</p>}{error&&<div className="toast" role="alert">{error}</div>}{success&&<div className="toast" role="status">{success}</div>}<button className="btn" disabled={busy}>{busy?"Отправляем...":requiresPayment?"Продолжить к оплате":"Продолжить"}</button></form>:<div className="toast" role="status">Лимит этой ссылки исчерпан.</div>}
    {showRoster?<><h2 className="section-title">{canManage?"Список гостей":"Кто уже записался"}</h2><div className="table-wrap"><table><thead><tr><th>Гость</th>{canManage&&<th>Телефон</th>}<th>Статус</th>{canManage&&<th/>}</tr></thead><tbody>{guests.map(guest=><tr key={guest.id}><td><strong>{guest.name}</strong></td>{canManage&&<td>{guest.phone}</td>}<td><span className="pill">{guest.ticketStatus==="PENDING_APPROVAL"?"Ожидает подтверждения":guest.ticketStatus==="USED"?"Прошёл":"Подтверждён"}</span></td>{canManage&&<td><button type="button" className="btn secondary" disabled={busy||guest.ticketStatus==="USED"} onClick={()=>void send({action:"remove",token,orderId:guest.id})}>Удалить</button></td>}</tr>)}{!guests.length&&<tr><td colSpan={canManage?4:2}>Пока никто не записан.</td></tr>}</tbody></table></div></>:<p className="muted">Список участников скрыт организатором.</p>}
  </section></main>;
}
