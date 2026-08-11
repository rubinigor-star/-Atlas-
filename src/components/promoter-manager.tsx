"use client";

import { useState } from "react";

type LegacyProps={events?:unknown;promoters?:unknown;showLinkForm?:boolean};

export function PromoterManager(_props:LegacyProps) {
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);

  function openPromoter(id:unknown){
    if(typeof id!=="string"||!id){setError("Промоутер создан, но Atlas не получил его ID. Обновите страницу и откройте его из списка.");return;}
    window.location.assign(`/office/promoters/${encodeURIComponent(id)}`);
  }

  async function submit(form:HTMLFormElement){
    const f=new FormData(form);setBusy(true);setError("");
    try{
      const response=await fetch("/api/admin/promoters",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"promoter",name:f.get("name"),email:f.get("email"),phone:f.get("phone"),commissionPercent:Number(f.get("commission")||0),autoAssignAllEvents:f.get("autoAssignAllEvents")==="on"})});
      const data=await response.json();
      if(response.status===409&&data.existingId){openPromoter(data.existingId);return;}
      if(!response.ok){setError(data.error||"Не удалось создать промоутера");setBusy(false);return;}
      openPromoter(data.id);
    }catch{
      setError("Не удалось завершить создание промоутера. Обновите страницу и проверьте список.");setBusy(false);
    }
  }

  return <div className="promoter-manager"><div className="panel form"><h2>Новый промоутер</h2><p className="muted">После создания Atlas сразу откроет карточку промоутера, где можно назначить первое мероприятие и отправить персональную ссылку.</p><form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget)}}>
    <div className="field"><label>Имя и фамилия</label><input className="input" name="name" required minLength={2}/></div>
    <div className="field"><label>Email *</label><input className="input" name="email" type="email" required/><small className="muted">На этот адрес Atlas отправляет персональные ссылки мероприятий.</small></div>
    <div className="field"><label>Телефон</label><input className="input" name="phone" type="tel"/></div>
    <div className="field"><label>Комиссия по умолчанию, %</label><input className="input" name="commission" type="number" min="0" max="100" step="0.01" defaultValue="0"/></div>
    <label className="row" style={{gap:8,alignItems:"flex-start"}}><input name="autoAssignAllEvents" type="checkbox"/><span><strong>Автоматически добавлять ко всем новым мероприятиям</strong><br/><small className="muted">При публикации нового мероприятия Atlas создаст персональную ссылку и отправит её этому промоутеру.</small></span></label>
    {error&&<div className="toast">{error}</div>}<button className="btn dark" disabled={busy}>{busy?"Создаём...":"Добавить промоутера"}</button>
  </form></div></div>;
}
