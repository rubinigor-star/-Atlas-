"use client";

import { useState, type ReactNode } from "react";
import styles from "./event-editor-workspace.module.css";

type TabId="about"|"sales"|"checkout"|"review";
const tabs:Array<{id:TabId;label:string}>=[
 {id:"about",label:"О мероприятии"},
 {id:"sales",label:"Продажа"},
 {id:"checkout",label:"Оформление заказа"},
 {id:"review",label:"Проверка и запуск"},
];

export function EventEditorWorkspace({about,sales,checkout,review,initialTab="about"}:{about:ReactNode;sales:ReactNode;checkout:ReactNode;review:ReactNode;initialTab?:TabId}){
 const[active,setActive]=useState<TabId>(initialTab);const index=tabs.findIndex(tab=>tab.id===active);
 function open(id:TabId){setActive(id);window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),0)}
 return <div className={styles.shell}>
  <nav className={styles.tabs} aria-label="Редактор мероприятия">{tabs.map((tab,i)=><button key={tab.id} type="button" onClick={()=>open(tab.id)} className={`${styles.tab} ${active===tab.id?styles.active:""}`} aria-current={active===tab.id?"step":undefined}><span className={styles.index}>{String(i+1).padStart(2,"0")}</span>{tab.label}</button>)}</nav>
  <div className={styles.content}>
   <section className={active==="about"?"":styles.hidden}>{about}</section>
   <section className={active==="sales"?"":styles.hidden}>{sales}</section>
   <section className={active==="checkout"?"":styles.hidden}>{checkout}</section>
   <section className={active==="review"?"":styles.hidden}>{review}</section>
  </div>
  <div className={styles.footer}>
   <button type="button" className={styles.secondary} disabled={index===0} onClick={()=>open(tabs[index-1].id)}>Назад</button>
   {index<tabs.length-1?<button type="button" className="btn" onClick={()=>open(tabs[index+1].id)}>Далее</button>:<span className="muted">Все настройки остаются доступны — публикация выполняется в этом разделе.</span>}
  </div>
 </div>;
}
