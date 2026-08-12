"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type FoundOrder={
  publicId:string;customerName:string;totalMinor:number;currency:string;status:string;createdAt:string;eventTitle:string;eventStartsAt:string;ticketCount:number;itemSummary:string;
  eligibility:{status:"STANDARD_ELIGIBLE"|"OUTSIDE_STANDARD"|"SPECIAL_REVIEW";reason:string;within14Days:boolean;nonRestDays:number};
  feeMinor:number;standardRefundMinor:number;canRequest:boolean;
};

function money(minor:number){return `${(minor/100).toLocaleString("he-IL",{minimumFractionDigits:0,maximumFractionDigits:2})} ₪`;}

export function CancellationCustomerForm({initialOrderId="",initialEmail=""}:{initialOrderId?:string;initialEmail?:string}){
  const [orderId,setOrderId]=useState(initialOrderId);
  const [email,setEmail]=useState(initialEmail);
  const [order,setOrder]=useState<FoundOrder|null>(null);
  const [reason,setReason]=useState("");
  const [special,setSpecial]=useState<""|"SENIOR"|"NEW_IMMIGRANT"|"DISABILITY">("");
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [submitted,setSubmitted]=useState<string|null>(null);
  const autoLookupStarted=useRef(false);

  async function lookup(id=orderId,mail=email){
    setBusy(true);setMessage("");setOrder(null);setSubmitted(null);
    try{
      const response=await fetch("/api/cancellations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:id,email:mail})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error==="ORDER_NOT_FOUND"?"Заказ не найден. Проверьте номер заказа и email.":body.error||"Не удалось найти заказ");
      setOrder(body.order);
    }catch(error){setMessage(error instanceof Error?error.message:"Не удалось найти заказ");}
    finally{setBusy(false);}
  }

  useEffect(()=>{
    if(autoLookupStarted.current||!initialOrderId||!initialEmail)return;
    autoLookupStarted.current=true;
    void lookup(initialOrderId,initialEmail);
  },[initialOrderId,initialEmail]);

  async function submit(){
    if(!accepted){setMessage("Подтвердите, что вы ознакомились с правилами отмены.");return;}
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/cancellations",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({orderId,email,reason,specialCategory:special||null,acceptedPolicy:true})});
      const body=await response.json();
      if(!response.ok){
        const text=body.error==="OPEN_REQUEST_EXISTS"?"По этому заказу уже есть открытая заявка на отмену.":body.error==="ORDER_NOT_CANCELLABLE"?"Этот заказ нельзя отправить на отмену.":body.error||"Не удалось отправить заявку";
        throw new Error(text);
      }
      setSubmitted(body.requestId);
    }catch(error){setMessage(error instanceof Error?error.message:"Не удалось отправить заявку");}
    finally{setBusy(false);}
  }

  if(submitted)return <section className="panel stack" style={{maxWidth:720,margin:"0 auto",textAlign:"center",padding:32}}>
    <span className="eyebrow">Заявка отправлена</span><h1>Заявка принята</h1><p>Номер обращения: <strong>{submitted}</strong>.</p><p className="muted">Заявка уже появилась в кабинете организатора мероприятия. Там Atlas покажет предварительную оценку права на возврат и расчёт суммы. После решения организатора статус возврата будет обновлён.</p><div className="row" style={{justifyContent:"center",gap:10,flexWrap:"wrap"}}><Link href="/" className="btn dark">Вернуться на Atlas One</Link><Link href="/cancellation-policy" className="btn secondary">Правила отмены</Link></div>
  </section>;

  return <div className="stack" style={{maxWidth:780,margin:"0 auto"}}>
    <div style={{textAlign:"center"}}><span className="eyebrow">Atlas One</span><h1>Заявка на отмену заказа</h1><p className="muted" style={{maxWidth:650,margin:"0 auto"}}>Введите данные заказа. Если вы пришли со страницы оплаченного заказа, данные будут подставлены автоматически.</p><p style={{marginTop:12}}><Link href="/cancellation-policy">Сначала ознакомиться с политикой отмены</Link></p></div>
    <section className="panel stack">
      <div className="field"><label>Номер заказа</label><input className="input" value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="ATL-..." autoComplete="off"/></div>
      <div className="field"><label>Email, использованный при покупке</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></div>
      <button className="btn dark" type="button" disabled={busy||!orderId||!email} onClick={()=>void lookup()}>{busy?"Ищем...":"Найти заказ"}</button>
      {message&&<div className="toast">{message}</div>}
    </section>
    {order&&<section className="panel stack">
      <div><span className="eyebrow">Заказ найден</span><h2>{order.eventTitle}</h2><p className="muted">Заказ {order.publicId} · {order.itemSummary} · {money(order.totalMinor)}</p></div>
      <div className="row between"><span className="muted">Дата покупки</span><strong>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</strong></div>
      <div className="row between"><span className="muted">Дата мероприятия</span><strong>{new Date(order.eventStartsAt).toLocaleString("ru-RU")}</strong></div>
      <div className="row between"><span className="muted">Расчётная комиссия отмены</span><strong>{money(order.feeMinor)}</strong></div>
      <div className="row between"><span className="muted">Ориентир стандартного возврата</span><strong>{money(order.standardRefundMinor)}</strong></div>
      <div className="panel" style={{background:order.eligibility.status==="STANDARD_ELIGIBLE"?"#f0fdf4":order.eligibility.status==="SPECIAL_REVIEW"?"#fffbeb":"#fff7ed",borderColor:order.eligibility.status==="STANDARD_ELIGIBLE"?"#bbf7d0":order.eligibility.status==="SPECIAL_REVIEW"?"#fde68a":"#fed7aa"}}>
        <strong>{order.eligibility.status==="STANDARD_ELIGIBLE"?"Предварительно возврат положен по стандартной политике":order.eligibility.status==="SPECIAL_REVIEW"?"Требуется специальная проверка":"Стандартное право на возврат автоматически не подтверждено"}</strong>
        <p className="muted" style={{marginBottom:0,marginTop:6}}>{order.eligibility.reason}</p>
      </div>
      <div className="field"><label>Причина отмены</label><textarea rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Напишите причину обращения. Заявку увидит организатор мероприятия."/></div>
      <div className="field"><label>Льготная категория, если применимо</label><select className="input" value={special} onChange={e=>setSpecial(e.target.value as typeof special)}><option value="">Не относится</option><option value="SENIOR">Пожилой гражданин</option><option value="NEW_IMMIGRANT">Новый репатриант</option><option value="DISABILITY">Человек с инвалидностью</option></select><small className="muted">При выборе льготной категории организатор может запросить подтверждающий документ.</small></div>
      <label className="panel" style={{display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer",background:"#f8fafc"}}><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Я ознакомился с <Link href="/cancellation-policy" target="_blank">מדיניות ביטול / правилами отмены</Link> и прошу передать заявку организатору.</span></label>
      <button className="btn dark" type="button" disabled={busy||!order.canRequest||!accepted} onClick={()=>void submit()}>{busy?"Отправляем...":"Отправить заявку организатору"}</button>
      {!order.canRequest&&<div className="toast">Для этого заказа сейчас нельзя открыть заявку на отмену.</div>}
    </section>}
  </div>;
}
