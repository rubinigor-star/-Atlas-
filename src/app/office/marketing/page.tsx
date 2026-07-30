import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { MarketingLinkBuilder } from "@/components/marketing-link-builder";
import { MarketingSettingsForm } from "@/components/marketing-settings-form";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { marketingIdentityKey } from "@/lib/marketing-compliance";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";

export const dynamic = "force-dynamic";
type CampaignRow={source:string|null;medium:string|null;campaign:string|null;orders:number;revenue:number};
type SettingsRow={metaPixelId:string|null;googleAnalyticsId:string|null;googleAdsId:string|null;tiktokPixelId:string|null};
type AudienceCustomer={key:string;name:string;email:string;phone:string;city:string|null;orders:number;totalMinor:number;lastPurchaseAt:Date};

export default async function MarketingPage() {
  const staff=await requirePermission("ANALYTICS_VIEW");
  const organizationId=staff.organizationId!;
  await ensureMarketingRuntime();
  const [events,paidOrders,recentOrders,campaigns,settings,customerOrders]=await Promise.all([
    db.event.findMany({where:{organizationId},orderBy:{startsAt:"desc"},take:30,select:{id:true,title:true,slug:true}}),
    db.order.aggregate({where:{status:"PAID",event:{organizationId}},_sum:{totalMinor:true},_count:{_all:true}}),
    db.order.findMany({where:{status:"PAID",event:{organizationId}},orderBy:{createdAt:"desc"},take:100,select:{totalMinor:true,createdAt:true}}),
    db.$queryRawUnsafe<CampaignRow[]>(`SELECT a.source, a.medium, a.campaign, COUNT(o.id) AS orders, COALESCE(SUM(o.totalMinor),0) AS revenue FROM OrderMarketingAttribution a JOIN "Order" o ON o.id=a.orderId JOIN Event e ON e.id=o.eventId WHERE e.organizationId=? AND o.status='PAID' GROUP BY a.source,a.medium,a.campaign ORDER BY revenue DESC`,organizationId),
    db.$queryRawUnsafe<SettingsRow[]>(`SELECT metaPixelId,googleAnalyticsId,googleAdsId,tiktokPixelId FROM OrganizationMarketingSettings WHERE organizationId=? LIMIT 1`,organizationId),
    db.order.findMany({where:{status:"PAID",event:{organizationId}},orderBy:{createdAt:"desc"},select:{customerName:true,customerEmail:true,customerPhone:true,customerCity:true,totalMinor:true,createdAt:true,guestId:true}}),
  ]);

  const audience=new Map<string,AudienceCustomer>();
  for(const order of customerOrders){
    const key=marketingIdentityKey({guestId:order.guestId,email:order.customerEmail,phone:order.customerPhone});
    const previous=audience.get(key);
    audience.set(key,{key,name:previous?.name??order.customerName,email:previous?.email??order.customerEmail,phone:previous?.phone??order.customerPhone,city:previous?.city??order.customerCity,orders:(previous?.orders??0)+1,totalMinor:(previous?.totalMinor??0)+order.totalMinor,lastPurchaseAt:previous&&previous.lastPurchaseAt>order.createdAt?previous.lastPurchaseAt:order.createdAt});
  }
  const customers=[...audience.values()].sort((a,b)=>b.lastPurchaseAt.getTime()-a.lastPurchaseAt.getTime());
  const revenue=paidOrders._sum.totalMinor??0;const orderCount=paidOrders._count._all;const averageOrder=orderCount?Math.round(revenue/orderCount):0;
  const last7Days=recentOrders.filter(order=>order.createdAt.getTime()>=Date.now()-7*86400000);const last7Revenue=last7Days.reduce((sum,order)=>sum+order.totalMinor,0);
  const attributedOrders=campaigns.reduce((sum,row)=>sum+Number(row.orders),0);const directOrders=Math.max(0,orderCount-attributedOrders);const attributedRevenue=campaigns.reduce((sum,row)=>sum+Number(row.revenue),0);const directRevenue=Math.max(0,revenue-attributedRevenue);const saved=settings[0];

  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">Atlas Marketing</span><h1>Рассылки, автоматизации и реклама</h1><p className="muted">Единый кабинет клиентской базы, согласий, Email, SMS, WhatsApp, рекламных ссылок и атрибуции продаж.</p></div><button className="btn" disabled title="Станет доступно после применения миграции согласий и настройки тарифов">+ Новая кампания</button></div>

    <div className="card" style={{borderLeft:"4px solid #f59e0b"}}><div className="row between"><div><span className="eyebrow">Правовой контроль</span><h2>Безопасный режим включён</h2></div><span className="pill">Отправка заблокирована</span></div><p className="muted">История покупок сохраняется полностью и не считается согласием на рекламу. Перед каждой отправкой Atlas отдельно проверит согласие на выбранный канал и отсутствие клиента в списке исключений.</p></div>

    <div className="stats"><div className="stat"><span className="muted">Клиенты в истории</span><strong>{customers.length}</strong><small>уникальные покупатели</small></div><div className="stat"><span className="muted">Email разрешён</span><strong>0</strong><small>нет подтверждённых согласий</small></div><div className="stat"><span className="muted">SMS разрешён</span><strong>0</strong><small>нет подтверждённых согласий</small></div><div className="stat"><span className="muted">WhatsApp разрешён</span><strong>0</strong><small>требуется отдельный opt-in</small></div></div>

    <div className="grid-2"><div className="card"><span className="eyebrow">Клиентская база</span><h2>Покупатели организатора</h2><p className="muted">Отписка исключает клиента только из рекламных кампаний. Заказы, билеты, платежи, возвраты и посещения остаются в Atlas.</p><div className="row"><span className="pill">{customers.length} клиентов</span><span className="pill">{orderCount} заказов</span><span className="pill">{money(revenue)}</span></div></div><div className="card"><span className="eyebrow">Согласия и запреты</span><h2>Независимый маркетинговый слой</h2><p className="muted">Согласия хранятся отдельно по организатору и каналу. Повторный импорт контакта не отменяет ранее установленную отписку.</p><div className="row"><span className="pill">Email</span><span className="pill">SMS</span><span className="pill">WhatsApp</span></div></div></div>

    <div className="card"><div className="row between"><div><span className="eyebrow">Аудитория</span><h2>Последние покупатели</h2></div><span className="pill">Только просмотр</span></div><div className="table-wrap"><table><thead><tr><th>Клиент</th><th>Город</th><th>Заказы</th><th>Сумма</th><th>Маркетинг</th></tr></thead><tbody>{customers.slice(0,10).map(customer=><tr key={customer.key}><td><strong>{customer.name}</strong><br/><small>{customer.email||customer.phone}</small></td><td>{customer.city||"Не указан"}</td><td>{customer.orders}</td><td>{money(customer.totalMinor)}</td><td><span className="pill">Согласие не подтверждено</span></td></tr>)}{customers.length===0&&<tr><td colSpan={5}><span className="muted">Покупатели появятся после оплаченных заказов.</span></td></tr>}</tbody></table></div></div>

    <div className="card"><div className="row between"><div><span className="eyebrow">Коммуникации</span><h2>Каналы и автоматизации</h2></div><span className="pill">Подготовлено основание</span></div><div className="grid-2"><div><h3>Email</h3><p className="muted">Языковые версии, обязательная отписка, открытия, клики и продажи.</p></div><div><h3>SMS</h3><p className="muted">Подсчёт частей, стоимость до запуска и обработка STOP / הסר.</p></div><div><h3>WhatsApp</h3><p className="muted">Подтверждённый opt-in, утверждённые шаблоны и мгновенная отписка.</p></div><div><h3>Автоматизации</h3><p className="muted">Брошенная корзина, лист ожидания, повторная продажа и post-event сценарии с лимитами частоты.</p></div></div></div>

    <div className="stats"><div className="stat"><span className="muted">Оплаченные продажи</span><strong>{money(revenue)}</strong><small>{orderCount} заказов</small></div><div className="stat"><span className="muted">Средний заказ</span><strong>{money(averageOrder)}</strong><small>по всем событиям</small></div><div className="stat"><span className="muted">Продажи за 7 дней</span><strong>{money(last7Revenue)}</strong><small>{last7Days.length} заказов</small></div><div className="stat"><span className="muted">Расходы на рассылки</span><strong>{money(0)}</strong><small>кампании не запускались</small></div></div>

    <div className="card"><div className="row between"><div><span className="eyebrow">Источники продаж</span><h2>Кампании и выручка</h2></div><span className="pill">Работает</span></div><p className="muted">Atlas сохраняет UTM-источник при переходе и связывает его с заказом в момент checkout.</p><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Кампания</th><th>Заказы</th><th>Выручка</th></tr></thead><tbody><tr><td><strong>Прямые продажи</strong><br/><small>Без рекламной метки</small></td><td>—</td><td>{directOrders}</td><td>{money(directRevenue)}</td></tr>{campaigns.map((row,index)=><tr key={`${row.source}-${row.campaign}-${index}`}><td><strong>{row.source||"Не указан"}</strong><br/><small>{row.medium||"—"}</small></td><td>{row.campaign||"Без названия"}</td><td>{Number(row.orders)}</td><td>{money(Number(row.revenue))}</td></tr>)}</tbody></table></div></div>

    <div id="utm"><MarketingLinkBuilder events={events.map(event=>({id:event.id,title:event.title,publicUrl:`/events/${event.slug}`}))}/></div>
    <div className="grid-2"><MarketingSettingsForm initial={{metaPixelId:saved?.metaPixelId??"",googleAnalyticsId:saved?.googleAnalyticsId??"",googleAdsId:saved?.googleAdsId??"",tiktokPixelId:saved?.tiktokPixelId??""}}/><div className="card"><span className="eyebrow">Промокоды и партнёры</span><h2>Связаны с продажами</h2><p className="muted">Промокоды, referral-коды и ссылки промоутеров продолжают работать через checkout.</p><div className="row"><Link className="btn secondary" href="/office/promoters">Промоутеры</Link><Link className="btn secondary" href="/office/events">Промокоды событий</Link></div></div></div>
  </AdminShell>;
}
