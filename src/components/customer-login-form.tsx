"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";

const copy = {
  ru: { title:"Войти в личный кабинет", help:"Укажите email, который использовали при покупке. Мы отправим одноразовую ссылку для входа.", email:"Email", send:"Отправить ссылку", sending:"Отправляем…", sent:"Если на этот email оформлялись заказы, ссылка для входа уже отправлена.", error:"Не удалось отправить ссылку" },
  he: { title:"כניסה לאזור האישי", help:"הזינו את כתובת האימייל ששימשה לרכישה. נשלח אליכם קישור חד-פעמי לכניסה.", email:"אימייל", send:"שליחת קישור כניסה", sending:"שולחים…", sent:"אם קיימות הזמנות על כתובת האימייל הזו, קישור הכניסה כבר נשלח.", error:"לא ניתן לשלוח את קישור הכניסה" },
  en: { title:"Sign in to your account", help:"Enter the email used for your purchase. We’ll send you a one-time sign-in link.", email:"Email", send:"Send sign-in link", sending:"Sending…", sent:"If orders exist for this email, a sign-in link has been sent.", error:"Could not send the sign-in link" },
} as const;

export function CustomerLoginForm({ expired = false }: { expired?: boolean }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(expired ? (locale === "he" ? "תוקף הקישור פג. בקשו קישור חדש." : locale === "en" ? "This link has expired. Request a new one." : "Срок действия ссылки истёк. Запросите новую.") : "");
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(false); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account/login", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ email:form.get("email") }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(true); setMessage(data.error || text.error); return; }
    setMessage(text.sent);
  }

  return <form className="panel form" onSubmit={submit} style={{maxWidth:520,margin:"40px auto"}}>
    <span className="eyebrow">Atlas One</span><h1>{text.title}</h1><p className="muted">{text.help}</p>
    <div className="field"><label>{text.email}</label><input className="input" name="email" type="email" autoComplete="email" required/></div>
    {message&&<div className="toast" style={error?{background:"#fff1f0",color:"#b42318"}:undefined}>{message}</div>}
    <button className="btn dark" disabled={busy}>{busy?text.sending:text.send}</button>
  </form>;
}
