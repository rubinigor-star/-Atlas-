"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/app/office/login/office-login.module.css";

const copy={
 ru:{kicker:"Atlas One",title:"Войти в личный кабинет",help:"Укажите email, который использовали при покупке. Мы отправим одноразовую ссылку для входа.",email:"Email",send:"Отправить ссылку",sending:"Отправляем…",sent:"Если на этот email оформлялись заказы, ссылка для входа уже отправлена.",error:"Не удалось отправить ссылку",back:"Вернуться на сайт",expired:"Срок действия ссылки истёк. Запросите новую."},
 he:{kicker:"Atlas One",title:"כניסה לאזור האישי",help:"הזינו את כתובת האימייל ששימשה לרכישה. נשלח אליכם קישור חד-פעמי לכניסה.",email:"Email",send:"שליחת קישור כניסה",sending:"שולחים…",sent:"אם קיימות הזמנות על כתובת האימייל הזו, קישור הכניסה כבר נשלח.",error:"לא ניתן לשלוח את קישור הכניסה",back:"חזרה לאתר",expired:"תוקף הקישור פג. בקשו קישור חדש."},
 en:{kicker:"Atlas One",title:"Sign in to your account",help:"Enter the email used for your purchase. We’ll send you a one-time sign-in link.",email:"Email",send:"Send sign-in link",sending:"Sending…",sent:"If orders exist for this email, a sign-in link has been sent.",error:"Could not send the sign-in link",back:"Return to website",expired:"This link has expired. Request a new one."}
} as const;

export function CustomerLoginForm({expired=false}:{expired?:boolean}){const{locale}=useLocale();const text=copy[locale];const[busy,setBusy]=useState(false);const[message,setMessage]=useState(expired?text.expired:"");const[error,setError]=useState(false);async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError(false);setMessage("");const form=new FormData(event.currentTarget);const response=await fetch("/api/account/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:form.get("email"),locale})});const data=await response.json();setBusy(false);if(!response.ok){setError(true);setMessage(data.error||text.error);return;}setMessage(text.sent);}return <><header className={styles.brand}><p className={styles.kicker}>{text.kicker}</p><h1 className={styles.title}>{text.title}</h1><p className={styles.subtitle}>{text.help}</p></header>{message&&<div className={styles.notice} style={error?{background:"#fff1f0",color:"#b42318"}:{background:"#ecfdf3",color:"#166534"}}>{message}</div>}<form className={styles.form} onSubmit={submit}><div className={styles.field}><label>{text.email}</label><input className={styles.input} dir="ltr" style={{textAlign:"left"}} name="email" type="email" autoComplete="email" required/></div><button className={styles.primaryButton} disabled={busy}>{busy?text.sending:text.send}</button></form><Link href="/" className={styles.backLink}>{text.back}</Link></>;
}
