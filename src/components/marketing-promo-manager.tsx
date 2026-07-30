"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarketingPromoManager({events}:{events:Array<{id:string;title:string}>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(form:HTMLFormElement){
    const data=new FormData(form);setBusy(true);setError("");
    const response=await fetch("/api/admin/marketing/promocodes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:data.get("eventId"),code:String(data.get("code")||"").toUpperCase(),discountPercent:Number(data.get("discountPercent")||0)})});
    const body=await response.json();setBusy(false);if(!response.ok)return setError(body.error||"Ошибка");form.reset();router.refresh();
  }
  return <div className="card"><div className="row between"><div><span className="eyebrow">Промокоды</span><h2>Новый код скидки</h2></div><span className="pill">Checkout</span></div><form onSubmit={(e)=>{e.preventDefault();void submit(e.currentTarget)}}><div className="form-grid"><label>Мероприятие<select name="eventId" required>{events.map(event=><option value={event.id} key={event.id}>{event.title}</option>)}</select></label><label>Код<input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" placeholder="SUMMER10"/></label><label>Скидка, %<input name="discountPercent" type="number" required min="1" max="100" defaultValue="10"/></label></div>{error&&<div className="toast">{error}</div>}<button className="btn" disabled={busy||!events.length}>{busy?"Сохраняю…":"Создать промокод"}</button></form></div>;
}
