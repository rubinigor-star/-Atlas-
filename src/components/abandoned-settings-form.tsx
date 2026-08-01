"use client";

import { useEffect, useState } from "react";

type Settings = { active:boolean; abandonAfterMinutes:number; firstEmailAfterMinutes:number; finalEmailAfterMinutes:number };

export function AbandonedSettingsForm() {
  const [settings,setSettings]=useState<Settings|null>(null);
  const [busy,setBusy]=useState(false);
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{void fetch("/api/office/abandoned/settings",{cache:"no-store"}).then(r=>r.json()).then(setSettings).catch(()=>setMessage("Не удалось загрузить настройки"));},[]);
  if(!settings)return <div className="panel">{message||"Загружаем настройки..."}</div>;
  async function save(){setBusy(true);setMessage("");const response=await fetch("/api/office/abandoned/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(settings)});const body=await response.json().catch(()=>({}));setMessage(response.ok?"Настройки сохранены":body.error||"Не удалось сохранить");setBusy(false);}
  async function runNow(){setRunning(true);setMessage("");const response=await fetch("/api/office/abandoned/run-now",{method:"POST"});const body=await response.json().catch(()=>({}));setMessage(response.ok?`Обработано: ${body.processed||0}, отправлено: ${body.sent||0}, ошибок: ${body.failed||0}, пропущено: ${body.skipped||0}`:body.error||"Не удалось запустить сценарий");setRunning(false);}
  return <div className="panel" style={{maxWidth:820}}>
    <div className="row between"><div><span className="eyebrow">Состояние</span><h2 style={{marginBottom:4}}>Автоматическое восстановление</h2><p className="muted">Отключение останавливает новые письма. История и статистика сохраняются.</p></div><label className="row" style={{gap:10}}><input type="checkbox" checked={settings.active} onChange={e=>setSettings({...settings,active:e.target.checked})}/><strong>{settings.active?"Включено":"Выключено"}</strong></label></div>
    <hr style={{border:0,borderTop:"1px solid #e5e7eb",margin:"24px 0"}}/>
    <div className="panel" style={{background:"#fff7ed",borderColor:"#fed7aa"}}><strong>Тестовый режим</strong><p className="muted" style={{marginBottom:0}}>Для проверки установите 1 минуту, сохраните настройки, пройдите checkout, подождите минуту и нажмите «Обработать сейчас».</p></div>
    <div className="field" style={{marginTop:18}}><label>Когда покупка считается потерянной, минут</label><input className="input" type="number" min={1} max={240} value={settings.abandonAfterMinutes} onChange={e=>setSettings({...settings,abandonAfterMinutes:Number(e.target.value)})}/></div>
    <div className="field" style={{marginTop:18}}><label>Первый Email после признания покупки потерянной, минут</label><input className="input" type="number" min={0} max={240} value={settings.firstEmailAfterMinutes} onChange={e=>setSettings({...settings,firstEmailAfterMinutes:Number(e.target.value)})}/><small className="muted">0 означает отправить при ближайшем запуске обработчика.</small></div>
    <div className="field" style={{marginTop:18}}><label>Финальный Email после признания покупки потерянной, минут</label><input className="input" type="number" min={1} max={10080} value={settings.finalEmailAfterMinutes} onChange={e=>setSettings({...settings,finalEmailAfterMinutes:Number(e.target.value)})}/></div>
    <div className="panel" style={{marginTop:20,background:"#f8fafc"}}><strong>Фактический маршрут</strong><p className="muted" style={{marginBottom:0}}>{settings.abandonAfterMinutes} мин. без активности → первый Email через {settings.firstEmailAfterMinutes} мин. → финальный Email через {settings.finalEmailAfterMinutes} мин. → остановка после покупки или отказа клиента.</p></div>
    {message&&<div className="toast" style={{marginTop:16}}>{message}</div>}
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}><button className="btn dark" disabled={busy} onClick={()=>void save()}>{busy?"Сохраняем...":"Сохранить настройки"}</button><button className="btn" disabled={running} onClick={()=>void runNow()}>{running?"Обрабатываем...":"Обработать сейчас"}</button></div>
  </div>;
}
