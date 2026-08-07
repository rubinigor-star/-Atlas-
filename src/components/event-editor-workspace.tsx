"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import styles from "./event-editor-workspace.module.css";

type TabId="about"|"tickets"|"map"|"checkout"|"review";

const copy={
 ru:{tabs:{about:"О мероприятии",tickets:"Билеты и цены",map:"Места и карта",checkout:"Покупатель и оформление",review:"Проверка и запуск"},aria:"Редактор мероприятия",back:"Назад",next:"Далее",saving:"Сохранение…",save:"Сохранить все изменения",noForms:"Формы для сохранения не найдены.",sent:"Все изменения сохранены.",reviewHint:"Проверьте настройки и откройте предварительный просмотр перед публикацией.",editorEyebrow:"Единый редактор мероприятия",editorDescription:"Каждая настройка находится только в одном разделе.",aboutEyebrow:"О мероприятии",aboutTitle:"Основная информация"},
 he:{tabs:{about:"על האירוע",tickets:"כרטיסים ומחירים",map:"מקומות ומפה",checkout:"רוכש ותהליך ההזמנה",review:"בדיקה והשקה"},aria:"עורך האירוע",back:"חזרה",next:"המשך",saving:"שומר…",save:"שמירת כל השינויים",noForms:"לא נמצאו טפסים לשמירה.",sent:"כל השינויים נשמרו.",reviewHint:"בדקו את ההגדרות ופתחו תצוגה מקדימה לפני הפרסום.",editorEyebrow:"עורך אירוע מאוחד",editorDescription:"כל הגדרה נמצאת במקום אחד בלבד.",aboutEyebrow:"על האירוע",aboutTitle:"מידע עיקרי"},
 en:{tabs:{about:"About the event",tickets:"Tickets and pricing",map:"Seats and map",checkout:"Buyer and checkout",review:"Review and launch"},aria:"Event editor",back:"Back",next:"Next",saving:"Saving…",save:"Save all changes",noForms:"No forms were found to save.",sent:"All changes were saved.",reviewHint:"Review the settings and open the preview before publishing.",editorEyebrow:"Unified event editor",editorDescription:"Each setting appears in one section only.",aboutEyebrow:"About the event",aboutTitle:"Main information"}
} as const;

function wait(milliseconds:number){return new Promise(resolve=>window.setTimeout(resolve,milliseconds));}

export function EventEditorWorkspace({about,tickets,map,checkout,review,initialTab="about"}:{about:ReactNode;tickets:ReactNode;map:ReactNode;checkout:ReactNode;review:ReactNode;initialTab?:TabId}){
 const{locale}=useLocale();const text=copy[locale];
 const tabs:Array<{id:TabId;label:string}>=[{id:"about",label:text.tabs.about},{id:"tickets",label:text.tabs.tickets},{id:"map",label:text.tabs.map},{id:"checkout",label:text.tabs.checkout},{id:"review",label:text.tabs.review}];
 const[active,setActive]=useState<TabId>(initialTab);const[saving,setSaving]=useState(false);const[saveMessage,setSaveMessage]=useState("");const contentRef=useRef<HTMLDivElement>(null);const index=tabs.findIndex(tab=>tab.id===active);
 useEffect(()=>{const header=contentRef.current?.parentElement?.previousElementSibling as HTMLElement|null;const eyebrow=header?.querySelector<HTMLElement>(".eyebrow");const description=header?.querySelector<HTMLElement>("p.muted");if(eyebrow)eyebrow.textContent=text.editorEyebrow;if(description)description.textContent=text.editorDescription;const aboutSection=contentRef.current?.querySelector<HTMLElement>('[data-editor-tab="about"]');const firstForm=aboutSection?.querySelector<HTMLElement>('form[data-unified-save="about"]');const formEyebrow=firstForm?.querySelector<HTMLElement>(".eyebrow");const formTitle=firstForm?.querySelector<HTMLElement>("h2");if(formEyebrow)formEyebrow.textContent=text.aboutEyebrow;if(formTitle)formTitle.textContent=text.aboutTitle;},[text]);
 function open(id:TabId){setActive(id);setSaveMessage("");window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0)}
 async function saveAbout(){
  const section=contentRef.current?.querySelector<HTMLElement>('[data-editor-tab="about"]');
  const forms=Array.from(section?.querySelectorAll<HTMLFormElement>('form[data-unified-save="about"]')||[]);
  if(!forms.length){setSaveMessage(text.noForms);return}
  for(const form of forms){if(!form.checkValidity()){form.reportValidity();return}}
  setSaving(true);setSaveMessage("");
  forms.forEach(form=>form.requestSubmit());

  // The main event form rewrites the event description. Wait for those requests to
  // finish, then save the complete multi-select event type array last so it cannot
  // be replaced by only the first selected type.
  await wait(3000);
  const typeSaveButton=section?.querySelector<HTMLButtonElement>('[data-event-type-manager="true"] button[data-workspace-local-save="true"]');
  if(typeSaveButton){
   typeSaveButton.click();
   await wait(1200);
   // A second final write protects against unusually slow form submissions.
   typeSaveButton.click();
   await wait(900);
  }else{
   await wait(300);
  }
  setSaving(false);setSaveMessage(text.sent);
 }
 return <div className={styles.shell}>
  <nav className={styles.tabs} aria-label={text.aria}>{tabs.map((tab,i)=><button key={tab.id} type="button" onClick={()=>open(tab.id)} className={`${styles.tab} ${active===tab.id?styles.active:""}`} aria-current={active===tab.id?"step":undefined}><span className={styles.index}>{String(i+1).padStart(2,"0")}</span>{tab.label}</button>)}</nav>
  <div ref={contentRef} className={styles.content}><section data-editor-tab="about" className={active==="about"?"":styles.hidden}>{about}</section><section data-editor-tab="tickets" className={active==="tickets"?"":styles.hidden}>{tickets}</section><section data-editor-tab="map" className={active==="map"?"":styles.hidden}>{map}</section><section data-editor-tab="checkout" className={active==="checkout"?"":styles.hidden}>{checkout}</section><section data-editor-tab="review" className={active==="review"?"":styles.hidden}>{review}</section></div>
  <div className={styles.footer}><button type="button" className={styles.secondary} disabled={index===0} onClick={()=>open(tabs[index-1].id)}>{text.back}</button>{active==="about"&&<div className={styles.saveGroup}><button type="button" className="btn" disabled={saving} onClick={()=>void saveAbout()}>{saving?text.saving:text.save}</button>{saveMessage&&<span className={styles.saveMessage}>{saveMessage}</span>}</div>}{index<tabs.length-1?<button type="button" className="btn dark" onClick={()=>open(tabs[index+1].id)}>{text.next}</button>:<span className="muted">{text.reviewHint}</span>}</div>
 </div>;
}
