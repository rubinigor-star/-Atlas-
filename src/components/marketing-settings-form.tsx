"use client";

import { useState } from "react";

type Values={metaPixelId:string;googleAnalyticsId:string;googleAdsId:string;tiktokPixelId:string};

export function MarketingSettingsForm({initial}:{initial:Values}){
  const [values,setValues]=useState(initial);const [state,setState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const field=(key:keyof Values,label:string,placeholder:string)=><label>{label}<input value={values[key]} onChange={e=>setValues({...values,[key]:e.target.value})} placeholder={placeholder}/></label>;
  async function save(){setState("saving");const res=await fetch("/api/marketing/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(values)});setState(res.ok?"saved":"error");}
  return <div className="card"><div className="row between"><div><span className="eyebrow">Пиксели</span><h2>Аналитика и рекламные сети</h2></div><span className="pill">Настройки</span></div><p className="muted">ID сохраняются для организации. События просмотра, начала checkout и покупки будут подключаться поверх этой базы.</p><div className="form-grid">{field("metaPixelId","Meta Pixel ID","123456789")}{field("googleAnalyticsId","Google Analytics","G-XXXXXXXXXX")}{field("googleAdsId","Google Ads","AW-XXXXXXXXX")}{field("tiktokPixelId","TikTok Pixel ID","CXXXXXXXXXXXX")}</div><div className="row" style={{marginTop:16}}><button className="btn" type="button" onClick={save} disabled={state==="saving"}>{state==="saving"?"Сохраняю…":"Сохранить настройки"}</button>{state==="saved"&&<span className="pill">Сохранено</span>}{state==="error"&&<span className="pill">Ошибка</span>}</div></div>;
}
