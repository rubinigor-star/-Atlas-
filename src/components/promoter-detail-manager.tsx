"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EventOption = { id:string; title:string; slug:string; categories:Array<{id:string;name:string}>; tables:Array<{id:string;label:string}> };
type LinkItem = { id:string; label:string; active:boolean; eventTitle:string; shareUrl:string };

function safeCode(value:string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,32);
}

export function PromoterDetailManager({ promoter, events, links }:{
  promoter:{id:string;name:string;active:boolean;defaultCommissionBps:number};
  events:EventOption[];
  links:LinkItem[];
}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState<string|null>(null);
  const [eventId,setEventId]=useState(events[0]?.id??"");
  const [allocationType,setAllocationType]=useState<"EVENT"|"CATEGORY"|"TABLE">("EVENT");
  const event=useMemo(()=>events.find(item=>item.id===eventId),[events,eventId]);

  async function post(payload:unknown){
    setBusy(true);setError("");
    const response=await fetch("/api/admin/promoters",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const data=await response.json();setBusy(false);
    if(!response.ok){setError(data.error||"Ошибка");return false;}
    router.refresh();return true;
  }

  async function copy(url:string,id:string){
    await navigator.clipboard.writeText(url);setCopied(id);window.setTimeout(()=>setCopied(null),1600);
  }

  return <div style={{display:"grid",gap:24}}>
    <div className="panel">
      <div className="row between"><div><span className="eyebrow">Ссылки продаж</span><h2 style={{marginBottom:4}}>Ссылки промоутера</h2></div><span className="pill">{links.filter(link=>link.active).length} активных</span></div>
      <div style={{display:"grid",gap:12,marginTop:18}}>
        {links.map(link=><div key={link.id} style={{border:"1px solid #e5e7eb",borderRadius:14,padding:16}}>
          <div className="row between" style={{gap:16,alignItems:"flex-start"}}>
            <div><strong>{link.label}</strong><div className="muted" style={{marginTop:3}}>{link.eventTitle}</div><code style={{display:"block",marginTop:8,wordBreak:"break-all"}}>{link.shareUrl}</code></div>
            <span className="pill" style={link.active?{background:"#dcfae6",color:"#067647"}:{background:"#f2f4f7",color:"#475467"}}>{link.active?"Активна":"Выключена"}</span>
          </div>
          <div className="row" style={{gap:8,marginTop:14,flexWrap:"wrap"}}>
            <button className="btn" type="button" onClick={()=>void copy(link.shareUrl,link.id)}>{copied===link.id?"Скопировано":"Копировать ссылку"}</button>
            <button className="btn" type="button" disabled={busy} onClick={()=>void post({action:"toggle",linkId:link.id,active:!link.active})}>{link.active?"Выключить":"Включить"}</button>
          </div>
        </div>)}
        {!links.length&&<p className="muted">У этого промоутера пока нет ссылок.</p>}
      </div>
    </div>

    {promoter.active&&<details className="panel" open={!links.length}>
      <summary style={{cursor:"pointer",fontWeight:700,fontSize:18}}>+ Создать ссылку продаж</summary>
      <form style={{display:"grid",gap:14,marginTop:20}} onSubmit={async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);
        const selected=events.find(item=>item.id===eventId);
        const base=safeCode(`${promoter.name}-${selected?.slug||"EVENT"}`);
        const suffix=Math.random().toString(36).slice(2,6).toUpperCase();
        const ok=await post({action:"link",eventId,promoterId:promoter.id,label:f.get("label"),code:`${base.slice(0,35)}-${suffix}`.slice(0,40),allocationType,categoryId:allocationType==="CATEGORY"?f.get("categoryId"):null,tableId:allocationType==="TABLE"?f.get("tableId"):null,guestLimit:f.get("guestLimit")?Number(f.get("guestLimit")):null,maxPerOrder:Number(f.get("maxPerOrder")||10),customPriceMinor:f.get("price")?Math.round(Number(f.get("price"))*100):null,commissionPercent:f.get("commission")?Number(f.get("commission")):promoter.defaultCommissionBps/100,exclusive:f.get("exclusive")==="on"});
        if(ok)e.currentTarget.reset();
      }}>
        <div className="field"><label>Мероприятие</label><select value={eventId} onChange={e=>setEventId(e.target.value)} required>{events.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
        <div className="field"><label>Название ссылки</label><input className="input" name="label" required minLength={2} placeholder={`Например, ${promoter.name} · основная`}/><small className="muted">Код ссылки создастся автоматически из имени промоутера и мероприятия.</small></div>
        <div className="field"><label>Что продаёт ссылка</label><select value={allocationType} onChange={e=>setAllocationType(e.target.value as typeof allocationType)}><option value="EVENT">Всё мероприятие</option><option value="CATEGORY">Категория билетов</option><option value="TABLE">Конкретный стол / объект</option></select></div>
        {allocationType==="CATEGORY"&&<div className="field"><label>Категория</label><select name="categoryId" required>{event?.categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
        {allocationType==="TABLE"&&<div className="field"><label>Стол / объект</label><select name="tableId" required>{event?.tables.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>}
        <div className="row" style={{gap:14,flexWrap:"wrap"}}>
          <div className="field" style={{flex:"1 1 160px"}}><label>Квота</label><input className="input" name="guestLimit" type="number" min="1" placeholder="Без ограничения"/></div>
          <div className="field" style={{flex:"1 1 160px"}}><label>Макс. в заказе</label><input className="input" name="maxPerOrder" type="number" min="1" max="50" defaultValue="10"/></div>
          <div className="field" style={{flex:"1 1 160px"}}><label>Спеццена, ₪</label><input className="input" name="price" type="number" min="0.01" step="0.01" placeholder="Обычная цена"/></div>
          <div className="field" style={{flex:"1 1 160px"}}><label>Комиссия, %</label><input className="input" name="commission" type="number" min="0" max="100" step="0.01" defaultValue={(promoter.defaultCommissionBps/100).toFixed(2)}/></div>
        </div>
        <label className="row"><input name="exclusive" type="checkbox"/> Эксклюзивно закрепить выбранный инвентарь</label>
        {error&&<div className="toast">{error}</div>}
        <button className="btn dark" disabled={busy||!events.length}>{busy?"Сохраняем...":"Создать ссылку"}</button>
      </form>
    </details>}

    <div className="panel" style={{borderColor:"#fda29b"}}>
      <h2>{promoter.active?"Архивировать промоутера":"Промоутер архивирован"}</h2>
      <p className="muted">История кликов, заказов, выручки и комиссий сохраняется. При архивировании все активные ссылки этого промоутера отключаются.</p>
      <button className="btn" disabled={busy} onClick={()=>void post({action:"archivePromoter",promoterId:promoter.id,active:!promoter.active})}>{promoter.active?"Архивировать":"Восстановить промоутера"}</button>
      {error&&<div className="toast" style={{marginTop:12}}>{error}</div>}
    </div>
  </div>;
}
