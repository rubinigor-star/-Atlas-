import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { MarketingLinkBuilder } from "@/components/marketing-link-builder";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const organizationId = staff.organizationId!;
  const [events, paidOrders, recentOrders] = await Promise.all([
    db.event.findMany({ where: { organizationId }, orderBy: { startsAt: "desc" }, take: 30, select: { id: true, title: true } }),
    db.order.aggregate({ where: { status: "PAID", event: { organizationId } }, _sum: { totalMinor: true }, _count: { _all: true } }),
    db.order.findMany({ where: { status: "PAID", event: { organizationId } }, orderBy: { createdAt: "desc" }, take: 50, select: { totalMinor: true, createdAt: true, event: { select: { title: true } } } }),
  ]);

  const revenue = paidOrders._sum.totalMinor ?? 0;
  const orderCount = paidOrders._count._all;
  const averageOrder = orderCount ? Math.round(revenue / orderCount) : 0;
  const last7Days = recentOrders.filter((order) => order.createdAt.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last7Revenue = last7Days.reduce((sum, order) => sum + order.totalMinor, 0);

  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">Продвижение</span><h1>Рекламный кабинет</h1><p className="muted">Единый центр ссылок, источников продаж, пикселей и рекламной аналитики.</p></div><Link href="#utm" className="btn">Создать рекламную ссылку</Link></div>

    <div className="stats">
      <div className="stat"><span className="muted">Оплаченные продажи</span><strong>{money(revenue)}</strong><small>{orderCount} заказов</small></div>
      <div className="stat"><span className="muted">Средний заказ</span><strong>{money(averageOrder)}</strong><small>по всем событиям</small></div>
      <div className="stat"><span className="muted">Продажи за 7 дней</span><strong>{money(last7Revenue)}</strong><small>{last7Days.length} заказов</small></div>
    </div>

    <div className="card"><div className="row between"><div><span className="eyebrow">Источники продаж</span><h2>Атрибуция кампаний</h2></div><span className="pill">MVP</span></div><p className="muted">Все ссылки, созданные ниже, получают UTM-метки. Следующим шагом Atlas будет сохранять источник в заказе и показывать выручку, конверсию и стоимость продажи по каждой кампании.</p><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Заказы</th><th>Выручка</th><th>Статус</th></tr></thead><tbody><tr><td><strong>Прямые продажи</strong><br/><small>Без UTM-меток</small></td><td>{orderCount}</td><td>{money(revenue)}</td><td><span className="pill">Активно</span></td></tr><tr><td><strong>Meta / Google / TikTok</strong><br/><small>После накопления UTM-данных</small></td><td>—</td><td>—</td><td><span className="pill">Подготовлено</span></td></tr></tbody></table></div></div>

    <div id="utm"><MarketingLinkBuilder events={events.map((event)=>({ id:event.id, title:event.title, publicUrl:`/events/${event.id}` }))} /></div>

    <div className="grid-2">
      <div className="card"><span className="eyebrow">Пиксели</span><h2>Аналитика и рекламные сети</h2><p className="muted">Подключение Meta Pixel, Google Analytics, Google Ads и TikTok Pixel будет управляться здесь без изменения кода сайта.</p><div className="row"><span className="pill">Meta Pixel</span><span className="pill">Google</span><span className="pill">TikTok</span></div></div>
      <div className="card"><span className="eyebrow">Промокоды</span><h2>Коды и партнёры</h2><p className="muted">Следующий блок добавит скидки, лимиты, сроки действия, персональные ссылки блогеров и статистику каждого партнёра.</p><span className="pill">Следующий этап</span></div>
    </div>
  </AdminShell>;
}
