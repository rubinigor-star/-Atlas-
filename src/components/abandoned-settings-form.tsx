"use client";

import { useEffect, useState } from "react";

type Settings = { active:boolean; abandonAfterMinutes:number; finalEmailAfterHours:number };

export function AbandonedSettingsForm() {
  const [settings,setSettings]=useState<Settings|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{void fetch("/api/office/abandoned/settings",{cache:"no-store"}).then(r=>r.json()).then(setSettings).catch(()=>setMessage("Не удалось загрузить настройки"));},[]);
  if(!settings)return <div className="panel">{message||"Загружаем настройки..."}</div>;
  async function save(){setBusy(true);setMessage("");const response=await fetch("/api/office/abandoned/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({active:settings!.active,finalEmailAfterHours:settings!.finalEmailAfterHours})});const body=await response.json().catch(()=>({}));setMessage(response.ok?"Настройки сохранены":body.error||"Не удалось сохранить");setBusy(false);}
  return <div className="panel" style={{maxWidth:760}}>
    <div className="row between"><div><span className="eyebrow">Состояние</span><h2 style={{marginBottom:4}}>Автоматическое восстановление</h2><p className="muted">Отключение останавливает новые письма. Уже сохранённая статистика не удаляется.</p></div><label className="row" style={{gap:10}}><input type="checkbox" checked={settings.active} onChange={e=>setSettings({...settings,active:e.target.checked})}/><strong>{settings.active?"Включено":"Выключено"}</strong></label></div>
    <hr style={{border:0,borderTop:"1px solid #e5e7eb",margin:"24px 0"}}/>
    <div className="field"><label>Когда покупка считается потерянной</label><input className="input" value={`${settings.abandonAfterMinutes} минут без активности`} disabled/><small className="muted">На базовом этапе этот защитный интервал фиксирован, чтобы не отправлять письмо человеку, который ещё заполняет форму.</small></div>
    <div className="field" style={{marginTop:18}}><label>Финальный Email после первого письма</label><input className="input" type="number" min={1} max={168} value={settings.finalEmailAfterHours} onChange={e=>setSettings({...settings,finalEmailAfterHours:Number(e.target.value)})}/><small className="muted">Допустимо от 1 до 168 часов.</small></div>
    <div className="panel" style={{marginTop:20,background:"#f8fafc"}}><strong>Фактический маршрут</strong><p className="muted" style={{marginBottom:0}}>30 минут без активности → первый Email → ожидание {settings.finalEmailAfterHours} ч. → финальный Email → остановка после успешной оплаты.</p></div>
    {message&&<div className="toast" style={{marginTop:16}}>{message}</div>}
    <button className="btn dark" style={{marginTop:18}} disabled={busy} onClick={()=>void save()}>{busy?"Сохраняем...":"Сохранить настройки"}</button>
  </div>;
}
