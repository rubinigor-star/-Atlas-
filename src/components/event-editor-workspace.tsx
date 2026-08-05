"use client";

import { useRef, useState, type ReactNode } from "react";
import styles from "./event-editor-workspace.module.css";

type TabId="about"|"tickets"|"map"|"checkout"|"review";
const tabs:Array<{id:TabId;label:string}>=[
 {id:"about",label:"О мероприятии"},
 {id:"tickets",label:"Билеты и цены"},
 {id:"map",label:"Места и карта"},
 {id:"checkout",label:"Покупатель и оформление"},
 {id:"review",label:"Проверка и запуск"},
];

export function EventEditorWorkspace({about,tickets,map,checkout,review,initialTab="about"}:{about:ReactNode;tickets:ReactNode;map:ReactNode;checkout:ReactNode;review:ReactNode;initialTab?:TabId}){
 const[active,setActive]=useState<TabId>(initialTab);
 const[saving,setSaving]=useState(false);
 const[saveMessage,setSaveMessage]=useState("");
 const contentRef=useRef<HTMLDivElement>(null);
 const index=tabs.findIndex(tab=>tab.id===active);

 function open(id:TabId){setActive(id);setSaveMessage("");window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0)}

 async function saveAbout(){
  const section=contentRef.current?.querySelector<HTMLElement>('[data-editor-tab="about"]');
  const forms=Array.from(section?.querySelectorAll<HTMLFormElement>('form[data-unified-save="about"]')||[]);
  if(!forms.length){setSaveMessage("Формы для сохранения не найдены.");return}
  for(const form of forms){if(!form.checkValidity()){form.reportValidity();return}}
  setSaving(true);setSaveMessage("");
  forms.forEach((form)=>form.requestSubmit());
  window.setTimeout(()=>{setSaving(false);setSaveMessage("Все изменения отправлены на сохранение.")},1000);
 }

 return <div className={styles.shell}>
  <nav className={styles.tabs} aria-label="Редактор мероприятия">{tabs.map((tab,i)=><button key={tab.id} type="button" onClick={()=>open(tab.id)} className={`${styles.tab} ${active===tab.id?styles.active:""}`} aria-current={active===tab.id?"step":undefined}><span className={styles.index}>{String(i+1).padStart(2,"0")}</span>{tab.label}</button>)}</nav>
  <div ref={contentRef} className={styles.content}>
   <section data-editor-tab="about" className={active==="about"?"":styles.hidden}>{about}</section>
   <section data-editor-tab="tickets" className={active==="tickets"?"":styles.hidden}>{tickets}</section>
   <section data-editor-tab="map" className={active==="map"?"":styles.hidden}>{map}</section>
   <section data-editor-tab="checkout" className={active==="checkout"?"":styles.hidden}>{checkout}</section>
   <section data-editor-tab="review" className={active==="review"?"":styles.hidden}>{review}</section>
  </div>
  <div className={styles.footer}>
   <button type="button" className={styles.secondary} disabled={index===0} onClick={()=>open(tabs[index-1].id)}>Назад</button>
   {active==="about"&&<div className={styles.saveGroup}>
    <button type="button" className="btn" disabled={saving} onClick={()=>void saveAbout()}>{saving?"Сохранение…":"Сохранить все изменения"}</button>
    {saveMessage&&<span className={styles.saveMessage}>{saveMessage}</span>}
   </div>}
   {index<tabs.length-1?<button type="button" className="btn dark" onClick={()=>open(tabs[index+1].id)}>Далее</button>:<span className="muted">Проверьте настройки и откройте предварительный просмотр перед публикацией.</span>}
  </div>
 </div>;
}
