"use client";

import { useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import styles from "./event-editor-workspace.module.css";

type TabId="about"|"tickets"|"map"|"checkout"|"review";

const copy={
 ru:{tabs:{about:"О мероприятии",tickets:"Билеты и цены",map:"Места и карта",checkout:"Покупатель и оформление",review:"Проверка и запуск"},aria:"Редактор мероприятия",back:"Назад",next:"Далее",saving:"Сохранение…",save:"Сохранить все изменения",noForms:"Формы для сохранения не найдены.",sent:"Все изменения отправлены на сохранение.",reviewHint:"Проверьте настройки и откройте предварительный просмотр перед публикацией."},
 he:{tabs:{about:"על האירוע",tickets:"כרטיסים ומחירים",map:"מקומות ומפה",checkout:"רוכש ותהליך ההזמנה",review:"בדיקה והשקה"},aria:"עורך האירוע",back:"חזרה",next:"המשך",saving:"שומר…",save:"שמירת כל השינויים",noForms:"לא נמצאו טפסים לשמירה.",sent:"כל השינויים נשלחו לשמירה.",reviewHint:"בדקו את ההגדרות ופתחו תצוגה מקדימה לפני הפרסום."},
 en:{tabs:{about:"About the event",tickets:"Tickets and pricing",map:"Seats and map",checkout:"Buyer and checkout",review:"Review and launch"},aria:"Event editor",back:"Back",next:"Next",saving:"Saving…",save:"Save all changes",noForms:"No forms were found to save.",sent:"All changes were submitted for saving.",reviewHint:"Review the settings and open the preview before publishing."}
} as const;

export function EventEditorWorkspace({about,tickets,map,checkout,review,initialTab="about"}:{about:ReactNode;tickets:ReactNode;map:ReactNode;checkout:ReactNode;review:ReactNode;initialTab?:TabId}){
 const{locale}=useLocale();const text=copy[locale];
 const tabs:Array<{id:TabId;label:string}>=[{id:"about",label:text.tabs.about},{id:"tickets",label:text.tabs.tickets},{id:"map",label:text.tabs.map},{id:"checkout",label:text.tabs.checkout},{id:"review",label:text.tabs.review}];
 const[active,setActive]=useState<TabId>(initialTab);const[saving,setSaving]=useState(false);const[saveMessage,setSaveMessage]=useState("");const contentRef=useRef<HTMLDivElement>(null);const index=tabs.findIndex(tab=>tab.id===active);
 function open(id:TabId){setActive(id);setSaveMessage("");window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0)}
 async function saveAbout(){const section=contentRef.current?.querySelector<HTMLElement>('[data-editor-tab="about"]');const forms=Array.from(section?.querySelectorAll<HTMLFormElement>('form[data-unified-save="about"]')||[]);if(!forms.length){setSaveMessage(text.noForms);return}for(const form of forms){if(!form.checkValidity()){form.reportValidity();return}}setSaving(true);setSaveMessage("");forms.forEach(form=>form.requestSubmit());window.setTimeout(()=>{setSaving(false);setSaveMessage(text.sent)},1000)}
 return <div className={styles.shell}>
  <nav className={styles.tabs} aria-label={text.aria}>{tabs.map((tab,i)=><button key={tab.id} type="button" onClick={()=>open(tab.id)} className={`${styles.tab} ${active===tab.id?styles.active:""}`} aria-current={active===tab.id?"step":undefined}><span className={styles.index}>{String(i+1).padStart(2,"0")}</span>{tab.label}</button>)}</nav>
  <div ref={contentRef} className={styles.content}><section data-editor-tab="about" className={active==="about"?"":styles.hidden}>{about}</section><section data-editor-tab="tickets" className={active==="tickets"?"":styles.hidden}>{tickets}</section><section data-editor-tab="map" className={active==="map"?"":styles.hidden}>{map}</section><section data-editor-tab="checkout" className={active==="checkout"?"":styles.hidden}>{checkout}</section><section data-editor-tab="review" className={active==="review"?"":styles.hidden}>{review}</section></div>
  <div className={styles.footer}><button type="button" className={styles.secondary} disabled={index===0} onClick={()=>open(tabs[index-1].id)}>{text.back}</button>{active==="about"&&<div className={styles.saveGroup}><button type="button" className="btn" disabled={saving} onClick={()=>void saveAbout()}>{saving?text.saving:text.save}</button>{saveMessage&&<span className={styles.saveMessage}>{saveMessage}</span>}</div>}{index<tabs.length-1?<button type="button" className="btn dark" onClick={()=>open(tabs[index+1].id)}>{text.next}</button>:<span className="muted">{text.reviewHint}</span>}</div>
 </div>;
}
