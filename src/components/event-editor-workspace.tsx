"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./event-editor-workspace.module.css";

type TabId="about"|"tickets"|"map"|"checkout"|"review";
const tabs:Array<{id:TabId;label:string}>=[
 {id:"about",label:"О мероприятии"},
 {id:"tickets",label:"Билеты и цены"},
 {id:"map",label:"Места и карта"},
 {id:"checkout",label:"Покупатель и оформление"},
 {id:"review",label:"Проверка и запуск"},
];

const savePattern = /(?:сохран|save|שמירת|שמור)/i;

function markSaveButtons(section: HTMLElement | null) {
 if (!section) return [] as HTMLFormElement[];
 const forms = Array.from(section.querySelectorAll<HTMLFormElement>("form"));
 return forms.filter((form) => {
  const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"],button:not([type])'));
  const saveButton = buttons.find((button) => savePattern.test(button.textContent || ""));
  if (!saveButton) return false;
  saveButton.dataset.workspaceLocalSave = "true";
  saveButton.hidden = true;
  return true;
 });
}

export function EventEditorWorkspace({about,tickets,map,checkout,review,initialTab="about"}:{about:ReactNode;tickets:ReactNode;map:ReactNode;checkout:ReactNode;review:ReactNode;initialTab?:TabId}){
 const[active,setActive]=useState<TabId>(initialTab);
 const[saving,setSaving]=useState(false);
 const[saveMessage,setSaveMessage]=useState("");
 const contentRef=useRef<HTMLDivElement>(null);
 const index=tabs.findIndex(tab=>tab.id===active);

 function activeSection(){return contentRef.current?.querySelector<HTMLElement>(`[data-editor-tab="${active}"]`)||null}
 function open(id:TabId){setActive(id);setSaveMessage("");window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0)}

 useEffect(()=>{
  const section=activeSection();
  markSaveButtons(section);
  const observer=new MutationObserver(()=>markSaveButtons(section));
  if(section)observer.observe(section,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[active]);

 async function saveActive(){
  const forms=markSaveButtons(activeSection());
  if(!forms.length){setSaveMessage("В этой вкладке нет несохранённых форм.");return}
  setSaving(true);setSaveMessage("");
  for(const form of forms){
   if(!form.checkValidity()){form.reportValidity();setSaving(false);return}
   form.requestSubmit();
   await new Promise(resolve=>window.setTimeout(resolve,120));
  }
  window.setTimeout(()=>{setSaving(false);setSaveMessage("Изменения вкладки отправлены на сохранение.")},700);
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
   <div className={styles.saveGroup}>
    {active!=="review"&&<button type="button" className="btn" disabled={saving} onClick={()=>void saveActive()}>{saving?"Сохранение…":"Сохранить"}</button>}
    {saveMessage&&<span className={styles.saveMessage}>{saveMessage}</span>}
   </div>
   {index<tabs.length-1?<button type="button" className="btn dark" onClick={()=>open(tabs[index+1].id)}>Далее</button>:<span className="muted">Проверьте настройки и откройте предварительный просмотр перед публикацией.</span>}
  </div>
 </div>;
}
