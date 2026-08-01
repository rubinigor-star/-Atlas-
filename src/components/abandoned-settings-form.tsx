"use client";

import { useEffect, useState } from "react";

type Settings = { active:boolean; abandonAfterMinutes:number; firstEmailAfterMinutes:number; finalEmailAfterMinutes:number };

export function AbandonedSettingsForm() {
  const [settings,setSettings]=useState<Settings|null>(null);
  const [savedSettings,setSavedSettings]=useState<Settings|null>(null);
  const [busy,setBusy]=useState(false);
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    void fetch("/api/office/abandoned/settings",{cache:"no-store"})
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Не удалось загрузить настройки");
        setSettings(body);
        setSavedSettings(body);
      })
      .catch(error=>setMessage(error instanceof Error ? error.message : "Не удалось загрузить настройки"));
  },[]);

  if(!settings)return <div className="panel">{message||"Загружаем настройки..."}</div>;
  const currentSettings: Settings = settings;
  const dirty = JSON.stringify(currentSettings) !== JSON.stringify(savedSettings);

  async function persistSettings(snapshot: Settings, showSuccess = true) {
    const response=await fetch("/api/office/abandoned/settings",{
      method:"PUT",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(snapshot),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||"Не удалось сохранить настройки");
    setSavedSettings({...snapshot});
    if(showSuccess)setMessage("Настройки сохранены на сервере");
  }

  async function save(){
    setBusy(true);
    setMessage("");
    try { await persistSettings(currentSettings,true); }
    catch(error){ setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки"); }
    finally { setBusy(false); }
  }

  async function runNow(){
    setRunning(true);
    setMessage("Сохраняем настройки и запускаем обработку...");
    try {
      await persistSettings(currentSettings,false);
      const response=await fetch("/api/office/abandoned/run-now",{method:"POST"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"Не удалось запустить сценарий");
      const reasons = body.skipReasons ? ` Причины пропуска: ${Object.entries(body.skipReasons).map(([reason,count])=>`${reason}: ${count}`).join(", ")}.` : "";
      setMessage(`Настройки сохранены. Новых потерянных: ${body.newlyAbandoned||0}, обработано писем: ${body.processed||0}, отправлено: ${body.sent||0}, ошибок: ${body.failed||0}, пропущено: ${body.skipped||0}.${reasons}`);
    } catch(error) {
      setMessage(error instanceof Error ? error.message : "Не удалось запустить сценарий");
    } finally {
      setRunning(false);
    }
  }

  return <div className="panel" style={{maxWidth:820}}>
    <div className="row between"><div><span className="eyebrow">Состояние</span><h2 style={{marginBottom:4}}>Автоматическое восстановление</h2><p className="muted">Отключение останавливает новые письма. История и статистика сохраняются.</p></div><label className="row" style={{gap:10}}><input type="checkbox" checked={currentSettings.active} onChange={e=>setSettings({...currentSettings,active:e.target.checked})}/><strong>{currentSettings.active?"Включено":"Выключено"}</strong></label></div>
    <hr style={{border:0,borderTop:"1px solid #e5e7eb",margin:"24px 0"}}/>
    <div className="panel" style={{background:"#fff7ed",borderColor:"#fed7aa"}}><strong>Тестовый режим</strong><p className="muted" style={{marginBottom:0}}>Установите 1 минуту и нажмите «Обработать сейчас». Кнопка сначала сохраняет текущие значения на сервере, затем запускает сценарий.</p></div>
    <div className="field" style={{marginTop:18}}><label>Когда покупка считается потерянной, минут</label><input className="input" type="number" min={1} max={240} value={currentSettings.abandonAfterMinutes} onChange={e=>setSettings({...currentSettings,abandonAfterMinutes:Number(e.target.value)})}/></div>
    <div className="field" style={{marginTop:18}}><label>Первый Email после признания покупки потерянной, минут</label><input className="input" type="number" min={0} max={240} value={currentSettings.firstEmailAfterMinutes} onChange={e=>setSettings({...currentSettings,firstEmailAfterMinutes:Number(e.target.value)})}/><small className="muted">0 означает отправить при ближайшем запуске обработчика.</small></div>
    <div className="field" style={{marginTop:18}}><label>Финальный Email после признания покупки потерянной, минут</label><input className="input" type="number" min={1} max={10080} value={currentSettings.finalEmailAfterMinutes} onChange={e=>setSettings({...currentSettings,finalEmailAfterMinutes:Number(e.target.value)})}/></div>
    <div className="panel" style={{marginTop:20,background:"#f8fafc"}}><strong>Фактический маршрут</strong><p className="muted" style={{marginBottom:0}}>{currentSettings.abandonAfterMinutes} мин. без активности → первый Email через {currentSettings.firstEmailAfterMinutes} мин. → финальный Email через {currentSettings.finalEmailAfterMinutes} мин. → остановка после покупки, отказа клиента или ручной остановки.</p></div>
    {dirty&&<div className="toast" style={{marginTop:16,background:"#fff7ed",borderColor:"#fed7aa"}}>Есть несохранённые изменения</div>}
    {message&&<div className="toast" style={{marginTop:16}}>{message}</div>}
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}><button className="btn dark" disabled={busy||running} onClick={()=>void save()}>{busy?"Сохраняем...":"Сохранить настройки"}</button><button className="btn" disabled={running||busy} onClick={()=>void runNow()}>{running?"Сохраняем и обрабатываем...":"Обработать сейчас"}</button></div>
  </div>;
}
