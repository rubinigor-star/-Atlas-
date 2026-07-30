import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { MarketingLinkBuilder } from "@/components/marketing-link-builder";
import { MarketingSettingsForm } from "@/components/marketing-settings-form";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";

export const dynamic = "force-dynamic";
type CampaignRow={source:string|null;medium:string|null;campaign:string|null;orders:number;revenue:number};
type SettingsRow={metaPixelId:string|null;googleAnalyticsId:string|null;googleAdsId:string|null;tiktokPixelId:string|null};

export default async function MarketingPage() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const organizationId = staff.organizationId!;
  await ensureMarketingRuntime();
  const [events, paidOrders, recentOrders, campaigns, settings] = await Promise.all([
    db.event.findMany({ where: { organizationId }, orderBy: { startsAt: "desc" }, take: 30, select: { id: true, title: true, slug:true } }),
    db.order.aggregate({ where: { status: "PAID", event: { organizationId } }, _sum: { totalMinor: true }, _count: { _all: true } }),
    db.order.findMany({ where: { status: "PAID", event: { organizationId } }, orderBy: { createdAt: "desc" }, take: 100, select: { totalMinor: true, createdAt: true } }),
    db.$queryRawUnsafe<CampaignRow[]>(`SELECT a.source, a.medium, a.campaign, COUNT(o.id) AS orders, COALESCE(SUM(o.totalMinor),0) AS revenue FROM OrderMarketingAttribution a JOIN "Order" o ON o.id=a.orderId JOIN Event e ON e.id=o.eventId WHERE e.organizationId=? AND o.status='PAID' GROUP BY a.source,a.medium,a.campaign ORDER BY revenue DESC`,organizationId),
    db.$queryRawUnsafe<SettingsRow[]>(`SELECT metaPixelId,googleAnalyticsId,googleAdsId,tiktokPixelId FROM OrganizationMarketingSettings WHERE organizationId=? LIMIT 1`,organizationId),
  ]);
  const revenue=paidOrders._sum.totalMinor??0;const orderCount=paidOrders._count._all;const averageOrder=orderCount?Math.round(revenue/orderCount):0;
  const last7Days=recentOrders.filter(order=>order.createdAt.getTime()>=Date.now()-7*86400000);const last7Revenue=last7Days.reduce((sum,order)=>sum+order.totalMinor,0);
  const attributedOrders=campaigns.reduce((sum,row)=>sum+Number(row.orders),0);const directOrders=Math.max(0,orderCount-attributedOrders);const attributedRevenue=campaigns.reduce((sum,row)=>sum+Number(row.revenue),0);const directRevenue=Math.max(0,revenue-attributedRevenue);const saved=settings[0];
  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">Продвижение</span><h1>Рекламный кабинет</h1><p className="muted">Источники заказов, кампании, партнёры, пиксели и рекламные ссылки.</p></div><Link href="#utm" className="btn">Создать рекламную ссылку</Link></div>
    <div className="stats"><div className="stat"><span className="muted">Оплаченные продажи</span><strong>{money(revenue)}</strong><small>{orderCount} заказов</small></div><div className="stat"><span className="muted">Средний заказ</span><strong>{money(averageOrder)}</strong><small>по всем событиям</small></div><div className="stat"><span className="muted">Продажи за 7 дней</span><strong>{money(last7Revenue)}</strong><small>{last7Days.length} заказов</small></div><div className="stat"><span className="muted">С рекламной атрибуцией</span><strong>{attributedOrders}</strong><small>{money(attributedRevenue)}</small></div></div>
    <div className="card"><div className="row between"><div><span className="eyebrow">Источники продаж</span><h2>Кампании и выручка</h2></div><span className="pill">Работает</span></div><p className="muted">Atlas сохраняет UTM-источник при переходе и связывает его с заказом в момент checkout.</p><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Кампания</th><th>Заказы</th><th>Выручка</th></tr></thead><tbody><tr><td><strong>Прямые продажи</strong><br/><small>Без рекламной метки</small></td><td>—</td><td>{directOrders}</td><td>{money(directRevenue)}</td></tr>{campaigns.map((row,index)=><tr key={`${row.source}-${row.campaign}-${index}`}><td><strong>{row.source||"Не указан"}</strong><br/><small>{row.medium||"—"}</small></td><td>{row.campaign||"Без названия"}</td><td>{Number(row.orders)}</td><td>{money(Number(row.revenue))}</td></tr>)}</tbody></table></div></div>
    <div id="utm"><MarketingLinkBuilder events={events.map(event=>({id:event.id,title:event.title,publicUrl:`/events/${event.slug}`}))}/></div>
    <div className="grid-2"><MarketingSettingsForm initial={{metaPixelId:saved?.metaPixelId??"",googleAnalyticsId:saved?.googleAnalyticsId??"",googleAdsId:saved?.googleAdsId??"",tiktokPixelId:saved?.tiktokPixelId??""}}/><div className="card"><span className="eyebrow">Промокоды и партнёры</span><h2>Уже связаны с продажами</h2><p className="muted">Существующие промокоды, referral-коды и ссылки промоутеров работают через checkout. Следующий интерфейс объединит их создание и статистику внутри этого кабинета.</p><div className="row"><Link className="btn secondary" href="/office/promoters">Промоутеры</Link><Link className="btn secondary" href="/office/events">Промокоды событий</Link></div></div></div>
  </AdminShell>;
}
