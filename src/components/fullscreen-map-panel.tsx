"use client";

import { useEffect, useState, type ReactNode } from "react";

export function FullscreenMapPanel({children}:{children:ReactNode}){
 const[open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
  window.addEventListener("keydown",close);
  return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close)};
 },[open]);
 return <div className={open?"map-overlay":"panel"} style={open?{position:"fixed",inset:0,zIndex:10000,background:"#fff",overflow:"auto",padding:16}:{background:"var(--surface, #fff)",overflow:"auto"}}>
  <div className="row between"><div><span className="eyebrow">Места и карта</span><h2>Схема зала и назначение билетов</h2></div><button type="button" className="btn secondary" onClick={()=>setOpen(value=>!value)}>{open?"Закрыть полноэкранный режим":"Открыть карту на весь экран"}</button></div>
  {children}
 </div>;
}
