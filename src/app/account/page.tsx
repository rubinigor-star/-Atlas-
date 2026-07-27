import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { getServerI18n } from "@/lib/server-locale";
import { eventDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

const copy = {
  ru: { eyebrow:"Личный кабинет", title:"Мои заказы и билеты", signed:"Вы вошли как", logout:"Выйти", upcoming:"Предстоящие", history:"История", empty:"Заказов пока нет", emptyHelp:"Покупки, оформленные на этот email, появятся здесь автоматически.", order:"Заказ", tickets:"Билетов", total:"Сумма", open:"Открыть заказ", pending:"Ожидает решения", awaiting:"Ожидает оплаты", paid:"Оплачен", rejected:"Не подтверждён", cancelled:"Отменён", eventPassed:"Мероприятие завершено" },
  he: { eyebrow:"האזור האישי", title:"ההזמנות והכרטיסים שלי", signed:"מחוברים באמצעות", logout:"יציאה", upcoming:"אירועים קרובים", history:"היסטוריה", empty:"עדיין אין הזמנות", emptyHelp:"רכישות שבוצעו עם כתובת האימייל הזו יופיעו כאן אוטומטית.", order:"הזמנה", tickets:"כרטיסים", total:"סכום", open:"פתיחת ההזמנה", pending:"ממתינה לבדיקה", awaiting:"ממתינה לתשלום", paid:"שולמה", rejected:"לא אושרה", cancelled:"בוטלה", eventPassed:"האירוע הסתיים" },
  en: { eyebrow:"Customer account", title:"My orders and tickets", signed:"Signed in as", logout:"Sign out", upcoming:"Upcoming", history:"History", empty:"No orders yet", emptyHelp:"Purchases made with this email will appear here automatically.", order:"Order", tickets:"Tickets", total:"Total", open:"Open order", pending:"Awaiting review", awaiting:"Awaiting payment", paid:"Paid", rejected:"Not approved", cancelled:"Cancelled", eventPassed:"Event ended" },
} as const;

function statusLabel(status: string, text: typeof copy.ru) {
  if (status === "PENDING" || status === "PENDING_APPROVAL") return text.pending;
  if (status === "AWAITING_PAYMENT") return text.awaiting;
  if (status === "PAID") return text.paid;
  if (status === "REJECTED") return text.rejected;
  if (status === "CANCELLED") return text.cancelled;
  return status;
}

export default async function CustomerAccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  const { locale } = await getServerI18n();
  const text = copy[locale];
  const orders = await db.order.findMany({
    where: { customerEmail: session.email },
    include: { event: { include: { venue: true } }, tickets: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  const upcoming = orders.filter((order) => order.event.startsAt >= now && !["CANCELLED", "REJECTED"].includes(order.status));
  const history = orders.filter((order) => !upcoming.some((item) => item.id === order.id));

  const cards = (items: typeof orders) => items.length ? <div className="event-grid">{items.map((order) => <article className="panel" key={order.id} style={{display:"grid",gap:14}}>
    <div className="row between" style={{alignItems:"flex-start"}}><div><span className="eyebrow">{text.order} {order.publicId}</span><h2 style={{margin:"6px 0"}}>{order.event.title}</h2><p className="muted" style={{margin:0}}>{eventDate(order.event.startsAt)} · {order.event.venue.name}, {order.event.venue.city}</p></div><span className="pill">{statusLabel(order.status,text)}</span></div>
    <div className="row between"><span className="muted">{text.tickets}</span><strong>{order.tickets.length}</strong></div>
    <div className="row between"><span className="muted">{text.total}</span><strong>{money(order.totalMinor)}</strong></div>
    <Link className="btn dark" href={`/orders/${order.publicId}`}>{text.open}</Link>
  </article>)}</div> : <div className="office-empty"><h3>{text.empty}</h3><p>{text.emptyHelp}</p></div>;

  return <main className="container" style={{paddingTop:36,paddingBottom:72}}>
    <div className="row between" style={{alignItems:"flex-start",marginBottom:28}}><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p className="muted">{text.signed} {session.email}</p></div><form method="post" action="/api/account/logout"><button className="btn secondary">{text.logout}</button></form></div>
    <h2 className="section-title">{text.upcoming}</h2>{cards(upcoming)}
    {history.length>0&&<><h2 className="section-title" style={{marginTop:38}}>{text.history}</h2>{cards(history)}</>}
  </main>;
}
