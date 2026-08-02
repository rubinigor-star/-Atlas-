"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Mail, MonitorSmartphone, WalletCards } from "lucide-react";
import type { TicketDesign } from "@/lib/ticket-template";
import { classicTicketPresets } from "@/lib/ticket-template";
import { formatTicketDate, formatTicketTime, getTicketLocale, ticketCopy, type TicketLocale, withTicketLocale } from "@/lib/ticket-language";

type EventData = { id:string; title:string; startsAt:string; venue:string; address:string; ticketType:string };
type PreviewMode = "PDF" | "WALLET" | "WEB" | "EMAIL";

const clone = (value: TicketDesign): TicketDesign => JSON.parse(JSON.stringify(value));

function QrPreview({ size = 112 }: { size?: number }) {
  return <div aria-label="QR preview" style={{ width:size,height:size,borderRadius:12,background:"repeating-conic-gradient(#081426 0 25%,#fff 0 50%) 50% / 14px 14px",border:"8px solid white",boxShadow:"0 0 0 1px #d7dee8" }} />;
}

function AtlasBrand({ accent }: { accent:string }) {
  return <div style={{display:"flex",alignItems:"center",gap:10,direction:"ltr"}}><span style={{width:40,height:40,borderRadius:12,background:"#081426",display:"grid",placeItems:"center",position:"relative",color:"white",fontSize:23,fontWeight:950}}>A<i style={{position:"absolute",right:4,top:4,width:8,height:8,borderRadius:99,background:accent}}/></span><strong style={{fontSize:18,letterSpacing:"-.04em"}}>ATLAS <span style={{color:accent}}>ONE</span></strong></div>;
}

export function TicketPresetPicker({ event, initialDesign }: { event:EventData; initialDesign:TicketDesign }) {
  const router = useRouter();
  const [design,setDesign] = useState(initialDesign);
  const [locale,setLocale] = useState<TicketLocale>(getTicketLocale(initialDesign));
  const [mode,setMode] = useState<PreviewMode>("PDF");
  const [busy,setBusy] = useState("");
  const [message,setMessage] = useState("");
  const startsAt = useMemo(()=>new Date(event.startsAt),[event.startsAt]);
  const copy = ticketCopy[locale];
  const rtl = locale === "he";

  async function save(nextDesign:TicketDesign, busyKey:string, success:string) {
    setBusy(busyKey); setMessage("");
    const localized = withTicketLocale(clone(nextDesign), locale);
    const response = await fetch(`/api/admin/events/${event.id}/ticket-template`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(localized)});
    const result = await response.json().catch(()=>({}));
    setBusy("");
    if(!response.ok){setMessage(result.error||"Не удалось сохранить шаблон");return;}
    setDesign(localized); setMessage(success); router.refresh();
  }

  async function changeLocale(nextLocale:TicketLocale) {
    setLocale(nextLocale); setBusy(`locale-${nextLocale}`); setMessage("");
    const localized = withTicketLocale(clone(design), nextLocale);
    const response = await fetch(`/api/admin/events/${event.id}/ticket-template`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(localized)});
    const result = await response.json().catch(()=>({}));
    setBusy("");
    if(!response.ok){setMessage(result.error||"Не удалось сохранить язык билета");return;}
    setDesign(localized); setMessage(nextLocale==="he"?"Язык реального билета сохранён: עברית":nextLocale==="en"?"Язык реального билета сохранён: English":"Язык реального билета сохранён: Русский"); router.refresh();
  }

  const date = formatTicketDate(startsAt,locale);
  const time = formatTicketTime(startsAt,locale);
  const modes = [
    {id:"PDF" as const,label:"PDF",icon:Download},
    {id:"WALLET" as const,label:"Apple Wallet",icon:WalletCards},
    {id:"WEB" as const,label:"Страница билета",icon:MonitorSmartphone},
    {id:"EMAIL" as const,label:"Email",icon:Mail},
  ];

  return <section style={{marginBottom:24,border:"1px solid #dce3ec",borderRadius:24,background:"#fff",overflow:"hidden",boxShadow:"0 18px 55px rgba(8,20,38,.08)"}}>
    <div style={{padding:"24px 28px",borderBottom:"1px solid #e6ebf2",background:"linear-gradient(135deg,#fff,#f7f9fc)"}}>
      <span className="eyebrow">Atlas Ticket Design System</span>
      <h1 style={{margin:"6px 0 8px",fontSize:30}}>Единый дизайн билета</h1>
      <p className="muted" style={{margin:0}}>Стиль и язык сохраняются для настоящих PDF, email и Apple Wallet. Переключатели ниже больше не являются только визуальным макетом.</p>
    </div>
    <div className="ticket-design-system-grid" style={{display:"grid",gridTemplateColumns:"minmax(260px,330px) minmax(0,1fr)"}}>
      <aside style={{padding:22,borderRight:"1px solid #e6ebf2",background:"#fbfcfe"}}>
        <h3 style={{margin:"0 0 5px"}}>1. Язык реального билета</h3>
        <p className="muted" style={{fontSize:13,margin:"0 0 12px"}}>Этот выбор применяется к датам, статусам и подписям PDF, email и Wallet.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:20}}>{(["ru","he","en"] as TicketLocale[]).map(item=><button key={item} disabled={Boolean(busy)} onClick={()=>void changeLocale(item)} className={locale===item?"btn":"btn secondary"}>{busy===`locale-${item}`?"…":item.toUpperCase()}</button>)}</div>
        <h3 style={{margin:"0 0 5px"}}>2. Выберите основу</h3>
        <div style={{display:"grid",gap:9,marginTop:12}}>{classicTicketPresets.map(preset=>{const active=design.name===preset.design.name;return <button key={preset.id} disabled={Boolean(busy)} onClick={()=>void save(preset.design,preset.id,`${preset.design.name} сохранён для реальных билетов`)} style={{border:active?`2px solid ${design.accentColor}`:"1px solid #dce3ec",borderRadius:14,padding:11,background:"white",cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:11}}><div style={{width:58,height:44,borderRadius:8,background:preset.design.backgroundColor,border:"1px solid #dce3ec",position:"relative"}}><i style={{position:"absolute",left:7,top:8,width:28,height:4,borderRadius:4,background:preset.design.textColor}}/><i style={{position:"absolute",right:6,bottom:6,width:14,height:14,border:"3px solid white",background:"#081426"}}/></div><div style={{flex:1}}><strong>{preset.label}</strong><small className="muted" style={{display:"block"}}>{busy===preset.id?"Сохраняем…":preset.description}</small></div>{active&&<span style={{width:24,height:24,borderRadius:99,background:design.accentColor,color:"white",display:"grid",placeItems:"center"}}><Check size={15}/></span>}</div></button>})}</div>
      </aside>
      <div style={{padding:22,minWidth:0}}>
        <div className="row between" style={{gap:14,flexWrap:"wrap",marginBottom:18}}><div><h3 style={{margin:"0 0 4px"}}>3. Предпросмотр форматов</h3><p className="muted" style={{margin:0,fontSize:13}}>Название автоматически уменьшается, если не помещается. Точный размер можно изменить ниже в редакторе.</p></div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{modes.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>setMode(item.id)} style={{display:"flex",alignItems:"center",gap:7,border:mode===item.id?"1px solid #081426":"1px solid #dce3ec",borderRadius:11,padding:"9px 12px",background:mode===item.id?"#081426":"white",color:mode===item.id?"white":"#344054",fontWeight:800,cursor:"pointer"}}><Icon size={16}/>{item.label}</button>})}</div></div>
        <div dir={rtl?"rtl":"ltr"} style={{minHeight:520,borderRadius:20,padding:24,background:"radial-gradient(circle at top,#eef3f9,#e6ebf2)",display:"grid",placeItems:"center"}}>
          <div style={{width:"min(100%,410px)",minHeight:mode==="EMAIL"?390:500,borderRadius:mode==="WALLET"?28:18,padding:28,position:"relative",overflow:"hidden",background:design.backgroundColor,color:design.textColor,boxShadow:"0 28px 70px rgba(8,20,38,.24)"}}>
            <div style={{position:"absolute",left:0,right:0,top:0,height:7,background:design.accentColor}}/>
            <AtlasBrand accent={design.accentColor}/>
            <span style={{position:"absolute",top:28,right:rtl?undefined:28,left:rtl?28:undefined,borderRadius:99,padding:"6px 10px",background:"#eaf8f0",color:"#167647",fontSize:10,fontWeight:900}}>{copy.valid}</span>
            <h2 style={{margin:"34px 0 8px",fontSize:"clamp(20px,5vw,30px)",lineHeight:1.05,overflowWrap:"anywhere"}}>{event.title}</h2>
            <p style={{margin:0,opacity:.75,fontWeight:700}}>{date} · {time}</p>
            <div style={{marginTop:26,display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,fontSize:14}}><div><small className="muted">{copy.venue}</small><strong style={{display:"block"}}>{event.venue}</strong></div><div><small className="muted">{copy.ticket}</small><strong style={{display:"block"}}>{event.ticketType}</strong></div><div><small className="muted">{copy.guest}</small><strong style={{display:"block"}}>{rtl?"איגור רובין":"Igor Rubin"}</strong></div><div><small className="muted">{copy.order}</small><strong style={{display:"block"}}>ATL-MS96RL2V</strong></div></div>
            <div style={{position:"absolute",left:28,right:28,bottom:28,display:"flex",justifyContent:"space-between",alignItems:"end",gap:18}}><small style={{opacity:.55}}>Powered by Atlas One</small><QrPreview size={mode==="WALLET"?150:118}/></div>
          </div>
        </div>
        {message&&<div className="toast" style={{marginTop:14}}>{message}</div>}
      </div>
    </div>
    <style jsx>{`@media(max-width:900px){.ticket-design-system-grid{grid-template-columns:1fr!important}.ticket-design-system-grid>aside{border-right:0!important;border-bottom:1px solid #e6ebf2}}`}</style>
  </section>;
}
