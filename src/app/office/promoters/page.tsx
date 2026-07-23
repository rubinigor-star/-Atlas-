import { AdminShell } from "@/components/admin-shell";
import { PromoterManager } from "@/components/promoter-manager";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUEST_LIST_PREFIX = "__GUEST_LIST__:";

export default async function PromotersPage() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const organizationId = staff.organizationId!;
  const [events, promoters, links] = await Promise.all([
    db.event.findMany({
      where: { organizationId },
      orderBy: { startsAt: "desc" },
      include: { categories: true, zones: { include: { tables: true } } },
    }),
    db.promoter.findMany({
      where: { organizationId, NOT: { name: { startsWith: GUEST_LIST_PREFIX } } },
      orderBy: { name: "asc" },
    }),
    db.promoterLink.findMany({
      where: {
        event: { organizationId },
        promoter: { NOT: { name: { startsWith: GUEST_LIST_PREFIX } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        promoter: true,
        event: true,
        category: true,
        table: true,
        visits: { select: { id: true } },
        orders: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } }, include: { items: true } },
      },
    }),
  ]);

  return <AdminShell>
    <span className="eyebrow">Promoter sales</span>
    <h1>Промоутеры</h1>
    <p className="muted">Здесь находятся только постоянные промоутеры и партнёры: их комиссии, персональные продажи и аналитика. Временные приглашения и именинники вынесены в отдельный раздел «Гостевые списки».</p>

    {staff.permissionSet.has("EVENT_MANAGE") && <PromoterManager
      promoters={promoters.map((item) => ({ id: item.id, name: item.name, defaultCommissionBps: item.defaultCommissionBps }))}
      events={events.map((event) => ({ id: event.id, title: event.title, categories: event.categories.map((item) => ({ id: item.id, name: item.name })), tables: event.zones.flatMap((zone) => zone.tables.map((item) => ({ id: item.id, label: `${zone.name} · ${item.label}` }))) }))}
    />}

    <h2 className="section-title">Аналитика промоутерских ссылок</h2>
    <div className="table-wrap"><table><thead><tr><th>Ссылка</th><th>Назначение</th><th>Клики</th><th>Заказы</th><th>Билеты</th><th>Конверсия</th><th>Выручка</th><th>Комиссия</th></tr></thead><tbody>
      {links.map((link) => {
        const orders = link.orders.length;
        const tickets = link.orders.flatMap((order) => order.items).reduce((sum, item) => sum + item.quantity, 0);
        const revenue = link.orders.reduce((sum, order) => sum + order.totalMinor, 0);
        const conversion = link.visits.length ? (orders / link.visits.length) * 100 : 0;
        const allocation = link.table ? `Стол: ${link.table.label}` : link.category ? `Категория: ${link.category.name}` : "Всё мероприятие";
        return <tr key={link.id}>
          <td><strong>{link.label}</strong><br /><small>{link.promoter.name} · {link.event.title}</small><br /><code>/p/{link.code}</code></td>
          <td>{allocation}<br /><small>{link.exclusive ? "Эксклюзивно" : "Общая продажа"}{link.guestLimit ? ` · квота ${link.guestLimit}` : ""}</small></td>
          <td>{link.visits.length}</td><td>{orders}</td><td>{tickets}</td><td>{conversion.toFixed(1)}%</td><td>{money(revenue)}</td><td>{money(Math.round(revenue * link.commissionBps / 10000))}</td>
        </tr>;
      })}
      {!links.length && <tr><td colSpan={8}>Пока нет созданных промоутерских ссылок.</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
