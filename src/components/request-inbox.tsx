"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Search, Trash2, UserRoundCheck, X } from "lucide-react";
import { money } from "@/lib/format";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { useLocale, type Locale } from "@/components/locale-provider";

type RequestItem = { name: string; quantity: number };
export type RequestRecord = {
  id: string;
  publicId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  birthDate: string | null;
  city: string | null;
  facebook: string | null;
  instagram: string | null;
  guestStatus: string | null;
  previousOrders: number;
  previousVisits: number;
  answer: string | null;
  status: string;
  eventTitle: string;
  eventDate: string;
  createdAt: string;
  expiresAt: string;
  inactive: boolean;
  totalMinor: number;
  items: RequestItem[];
};

type QueueFilter = "all" | "PENDING_APPROVAL" | "AWAITING_PAYMENT" | "PAID" | "REJECTED" | "CANCELLED";

type Copy = {
  statuses: Record<string, string>;
  filters: Record<QueueFilter, string>;
  expiredError: string;
  approveNote: string;
  rejectNote: string;
  processError: string;
  approveSuccess: string;
  approveEmailError: string;
  rejectSuccess: string;
  rejectEmailError: string;
  dismissConfirm: string;
  dismissError: string;
  dismissed: string;
  search: string;
  inactive: string;
  expiredNotice: (date: string) => string;
  years: string;
  cityMissing: string;
  previous: (orders: number, visits: number) => string;
  instagramMissing: string;
  facebookMissing: string;
  customerAnswer: string;
  received: string;
  whatsappLabel: (name: string) => string;
  whatsappMessage: (name: string, eventTitle: string) => string;
  details: string;
  changeStatus: (name: string) => string;
  processing: string;
  changeStatusPlaceholder: string;
  approveFull: string;
  reject: string;
  approve: string;
  deleting: string;
  remove: string;
  emptyTitle: string;
  emptyText: string;
  openAll: string;
};

const copy: Record<Locale, Copy> = {
  ru: {
    statuses: { PENDING_APPROVAL:"Ожидает решения", AWAITING_PAYMENT:"Одобрена · ждёт оплату", PAID:"Оплачена · билет выдан", REJECTED:"Отклонена", CANCELLED:"Отменена" },
    filters: { PENDING_APPROVAL:"Ожидают", AWAITING_PAYMENT:"Одобрены", PAID:"Оплачены", REJECTED:"Отклонены", CANCELLED:"Отменены", all:"Все" },
    expiredError:"Срок действия заявки истёк. Её больше нельзя одобрить или отклонить — удалите её из очереди.",
    approveNote:"Одобрено в Atlas Office", rejectNote:"Заявка отклонена организатором", processError:"Не удалось обработать заявку",
    approveSuccess:"Заявка одобрена, оплата завершена, билеты и email отправлены клиенту.", approveEmailError:"Заявка одобрена, но email не отправлен",
    rejectSuccess:"Заявка отклонена, уведомление отправлено клиенту.", rejectEmailError:"Заявка отклонена, но email не отправлен",
    dismissConfirm:"Удалить эту неактивную заявку из очереди? Она останется в журнале действий, но больше не будет отображаться в списке.", dismissError:"Не удалось удалить заявку из очереди", dismissed:"Неактивная заявка удалена из очереди.",
    search:"Имя, телефон, город, мероприятие или статус", inactive:"Неактивна · срок истёк", expiredNotice:(date)=>`Срок резерва истёк ${date}. Места и авторизация оплаты освобождены. Заявку больше нельзя одобрить.`,
    years:"лет", cityMissing:"Город не указан", previous:(orders,visits)=>`Заказов ранее: ${orders} · посещений: ${visits}`, instagramMissing:"Instagram не указан", facebookMissing:"Facebook не указан", customerAnswer:"Ответ клиента", received:"Получена",
    whatsappLabel:(name)=>`Открыть WhatsApp с ${name}`, whatsappMessage:(name,eventTitle)=>`Здравствуйте, ${name}. Пишем вам по поводу заявки на мероприятие «${eventTitle}».`, details:"Подробнее", changeStatus:(name)=>`Изменить статус заявки ${name}`,
    processing:"Обрабатываем…", changeStatusPlaceholder:"Изменить статус", approveFull:"Одобрить, списать оплату и выдать билет", reject:"Отклонить", approve:"Одобрить", deleting:"Удаляем…", remove:"Удалить из очереди", emptyTitle:"В этой категории заявок нет", emptyText:"Смените фильтр или поисковый запрос.", openAll:"Открыть всю очередь"
  },
  he: {
    statuses: { PENDING_APPROVAL:"ממתינה לבדיקה", AWAITING_PAYMENT:"אושרה · ממתינה לתשלום", PAID:"שולמה · הכרטיס הונפק", REJECTED:"לא אושרה", CANCELLED:"בוטלה" },
    filters: { PENDING_APPROVAL:"ממתינות לבדיקה", AWAITING_PAYMENT:"אושרו", PAID:"שולמו", REJECTED:"לא אושרו", CANCELLED:"בוטלו", all:"הכול" },
    expiredError:"תוקף הבקשה פג. לא ניתן עוד לאשר או לדחות אותה — אפשר להסיר אותה מהתור.",
    approveNote:"הבקשה אושרה באזור המפיקים", rejectNote:"הבקשה לא אושרה על ידי המפיק", processError:"לא ניתן לעדכן את הבקשה",
    approveSuccess:"הבקשה אושרה, התשלום הושלם והכרטיסים נשלחו ללקוח במייל.", approveEmailError:"הבקשה אושרה, אך המייל לא נשלח",
    rejectSuccess:"הבקשה לא אושרה והודעה נשלחה ללקוח.", rejectEmailError:"הבקשה לא אושרה, אך המייל לא נשלח",
    dismissConfirm:"להסיר את הבקשה הלא פעילה מהתור? היא תישאר ביומן הפעילות אך לא תופיע עוד ברשימה.", dismissError:"לא ניתן להסיר את הבקשה מהתור", dismissed:"הבקשה הלא פעילה הוסרה מהתור.",
    search:"שם, טלפון, עיר, אירוע או סטטוס", inactive:"לא פעילה · התוקף פג", expiredNotice:(date)=>`תוקף השריון פג ב־${date}. המקומות ואישור התשלום שוחררו, ולא ניתן עוד לאשר את הבקשה.`,
    years:"שנים", cityMissing:"העיר לא צוינה", previous:(orders,visits)=>`הזמנות קודמות: ${orders} · ביקורים: ${visits}`, instagramMissing:"לא צוין Instagram", facebookMissing:"לא צוין Facebook", customerAnswer:"תשובת הלקוח", received:"התקבלה",
    whatsappLabel:(name)=>`פתיחת WhatsApp עם ${name}`, whatsappMessage:(name,eventTitle)=>`שלום ${name}, אנחנו פונים אליך בנוגע לבקשת ההשתתפות באירוע „${eventTitle}”.`, details:"לפרטים", changeStatus:(name)=>`עדכון הסטטוס של הבקשה מאת ${name}`,
    processing:"מעדכנים…", changeStatusPlaceholder:"עדכון סטטוס", approveFull:"אישור הבקשה, השלמת התשלום והנפקת הכרטיס", reject:"לא לאשר", approve:"לאשר", deleting:"מסירים…", remove:"הסרה מהתור", emptyTitle:"אין בקשות בקטגוריה הזו", emptyText:"אפשר לבחור מסנן אחר או לשנות את החיפוש.", openAll:"לכל הבקשות"
  },
  en: {
    statuses: { PENDING_APPROVAL:"Pending review", AWAITING_PAYMENT:"Approved · awaiting payment", PAID:"Paid · ticket issued", REJECTED:"Not approved", CANCELLED:"Cancelled" },
    filters: { PENDING_APPROVAL:"Pending", AWAITING_PAYMENT:"Approved", PAID:"Paid", REJECTED:"Not approved", CANCELLED:"Cancelled", all:"All" },
    expiredError:"This request has expired and can no longer be approved or declined. Remove it from the queue instead.",
    approveNote:"Approved in Atlas Office", rejectNote:"Request declined by the organizer", processError:"Could not update the request",
    approveSuccess:"Request approved, payment completed, and tickets emailed to the customer.", approveEmailError:"Request approved, but the email was not sent",
    rejectSuccess:"Request declined and the customer was notified.", rejectEmailError:"Request declined, but the email was not sent",
    dismissConfirm:"Remove this inactive request from the queue? It will remain in the activity log but will no longer appear here.", dismissError:"Could not remove the request from the queue", dismissed:"Inactive request removed from the queue.",
    search:"Name, phone, city, event, or status", inactive:"Inactive · expired", expiredNotice:(date)=>`The reservation expired on ${date}. Seats and payment authorization were released, and the request can no longer be approved.`,
    years:"years old", cityMissing:"City not provided", previous:(orders,visits)=>`Previous orders: ${orders} · visits: ${visits}`, instagramMissing:"Instagram not provided", facebookMissing:"Facebook not provided", customerAnswer:"Customer response", received:"Received",
    whatsappLabel:(name)=>`Open WhatsApp with ${name}`, whatsappMessage:(name,eventTitle)=>`Hello ${name}, we are contacting you about your request for “${eventTitle}”.`, details:"View details", changeStatus:(name)=>`Change status for ${name}`,
    processing:"Updating…", changeStatusPlaceholder:"Change status", approveFull:"Approve, capture payment, and issue ticket", reject:"Decline", approve:"Approve", deleting:"Removing…", remove:"Remove from queue", emptyTitle:"No requests in this category", emptyText:"Try another filter or search term.", openAll:"Open full queue"
  }
};

const statusColors: Record<string, { background: string; color: string }> = {
  PENDING_APPROVAL: { background: "#fff4cc", color: "#8a5a00" },
  AWAITING_PAYMENT: { background: "#dbeafe", color: "#1d4ed8" },
  PAID: { background: "#dcfce7", color: "#166534" },
  REJECTED: { background: "#fee2e2", color: "#b91c1c" },
  CANCELLED: { background: "#e5e7eb", color: "#4b5563" },
};

function age(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const now = new Date();
  let result = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) result--;
  return result;
}

function dateLocale(locale: Locale) { return locale === "he" ? "he-IL" : locale === "en" ? "en-IL" : "ru-IL"; }

function whatsapp(phone: string, message: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function RequestInbox({ initialRequests, compact = false }: { initialRequests: RequestRecord[]; compact?: boolean }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<QueueFilter>("PENDING_APPROVAL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const counts = Object.fromEntries(["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAID", "REJECTED", "CANCELLED"].map((status) => [status, requests.filter((item) => item.status === status).length]));
  const visible = useMemo(() => requests.filter((item) => (filter === "all" || item.status === filter) && `${item.customerName} ${item.customerPhone} ${item.eventTitle} ${item.city || ""} ${item.status}`.toLowerCase().includes(query.toLowerCase())).slice(0, compact ? 5 : 999), [requests, filter, query, compact]);

  async function decide(item: RequestRecord, action: "approve" | "reject") {
    if (item.inactive) { setError(text.expiredError); return; }
    setBusy(item.id); setError(""); setNotice("");
    const response = await fetch(`/api/admin/orders/${item.publicId}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action, note:action === "approve" ? text.approveNote : text.rejectNote }) });
    const data = await response.json();
    if (data.status) setRequests((current) => current.map((record) => record.id === item.id ? { ...record, status:data.status, inactive:false } : record));
    if (!response.ok) { setError(data.error || text.processError); setBusy(""); return; }
    const suffix = data.emailError ? `: ${data.emailError}` : ".";
    if (action === "approve") setNotice(data.emailSent ? text.approveSuccess : `${text.approveEmailError}${suffix}`);
    else setNotice(data.emailSent ? text.rejectSuccess : `${text.rejectEmailError}${suffix}`);
    setBusy("");
  }

  async function dismiss(item: RequestRecord) {
    if (!window.confirm(text.dismissConfirm)) return;
    setBusy(item.id); setError(""); setNotice("");
    const response = await fetch(`/api/admin/orders/${item.publicId}`, { method:"DELETE" });
    const data = await response.json();
    if (!response.ok) { setError(data.error || text.dismissError); setBusy(""); return; }
    setRequests((current) => current.filter((record) => record.id !== item.id)); setNotice(text.dismissed); setBusy("");
  }

  const filters: Array<[QueueFilter, string]> = (["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAID", "REJECTED", "CANCELLED", "all"] as QueueFilter[]).map((key) => [key, text.filters[key]]);

  return <>
    <div className="request-kpis">{filters.map(([key,label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}><Clock3/><span>{label}</span><strong>{key === "all" ? requests.length : counts[key] || 0}</strong></button>)}</div>
    <div className="request-toolbar"><label><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></label></div>
    {error && <div className="toast" style={{background:"#fff1f0",color:"#b42318"}}>{error}</div>}
    {notice && <div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>{notice}</div>}
    <div className="request-grid">
      {visible.map((item) => {
        const color = statusColors[item.status] || { background:"#e5e7eb", color:"#111827" };
        const meta = item.inactive ? { label:text.inactive, background:"#f3f4f6", color:"#6b7280" } : { label:text.statuses[item.status] || item.status, ...color };
        const customerAge = age(item.birthDate);
        return <article className="request-card" key={item.id} style={item.inactive ? {opacity:.78,borderStyle:"dashed"} : undefined}>
          <header><div className="request-avatar">{item.customerName.split(" ").map((part) => part[0]).slice(0,2).join("")}</div><div><strong>{item.customerName}</strong><a href={`tel:${item.customerPhone}`}>{item.customerPhone}</a></div><span className="request-status" style={{background:meta.background,color:meta.color}}>{meta.label}</span></header>
          {item.inactive && <div className="toast" style={{background:"#f8fafc",color:"#475569",marginBottom:12}}>{text.expiredNotice(new Date(item.expiresAt).toLocaleString(dateLocale(locale)))}</div>}
          <div className="request-event"><small>{item.eventTitle}</small><strong>{item.items.map((ticket) => `${ticket.name} × ${ticket.quantity}`).join(", ")}</strong><span>{money(item.totalMinor)}</span></div>
          {!compact && <div className="panel" style={{background:"#f8fafc"}}><strong>{item.guestStatus || "REGULAR"}</strong><p className="muted">{customerAge !== null ? `${customerAge} ${text.years} · ` : ""}{item.city || text.cityMissing}</p><p className="muted">{text.previous(item.previousOrders,item.previousVisits)}</p><p className="muted">{item.instagram || text.instagramMissing} · {item.facebook || text.facebookMissing}</p></div>}
          {item.answer && <blockquote><small>{text.customerAnswer}</small>{item.answer}</blockquote>}
          <footer><small>{text.received} {new Date(item.createdAt).toLocaleString(dateLocale(locale))}</small><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><a className="btn secondary" style={{color:"#128C7E"}} target="_blank" rel="noreferrer" href={whatsapp(item.customerPhone,text.whatsappMessage(item.customerName,item.eventTitle))} aria-label={text.whatsappLabel(item.customerName)}><WhatsAppIcon size={18}/> WhatsApp</a><Link className="btn secondary" href={`/office/orders/${item.publicId}?returnTo=${encodeURIComponent("/office/requests")}`}>{text.details}</Link></div></footer>
          {item.status === "PENDING_APPROVAL" && !item.inactive && <div className="request-actions"><select aria-label={text.changeStatus(item.customerName)} defaultValue="" disabled={busy === item.id} onChange={(event) => { const value = event.target.value; event.target.value = ""; if (value === "approve") void decide(item,"approve"); if (value === "reject") void decide(item,"reject"); }}><option value="" disabled>{busy === item.id ? text.processing : text.changeStatusPlaceholder}</option><option value="approve">{text.approveFull}</option><option value="reject">{text.reject}</option></select><button disabled={busy === item.id} className="approve" onClick={() => void decide(item,"approve")}><Check size={18}/>{busy === item.id ? text.processing : text.approve}</button><button disabled={busy === item.id} className="reject" onClick={() => void decide(item,"reject")}><X size={18}/>{text.reject}</button></div>}
          {(item.inactive || item.status === "CANCELLED" || item.status === "REJECTED") && !compact && <div className="request-actions"><button disabled={busy === item.id} className="reject" onClick={() => void dismiss(item)}><Trash2 size={18}/>{busy === item.id ? text.deleting : text.remove}</button></div>}
        </article>;
      })}
      {visible.length === 0 && <div className="office-empty"><UserRoundCheck size={38}/><h3>{text.emptyTitle}</h3><p>{text.emptyText}</p></div>}
    </div>
    {compact && <Link className="btn secondary" href="/office/requests">{text.openAll}</Link>}
  </>;
}
