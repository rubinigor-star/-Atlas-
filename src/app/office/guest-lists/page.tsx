import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";
const GUEST_LIST_PREFIXES = ["__GUEST_LIST__:", "__CHANNEL__:GUEST:"];

export default async function GuestListsPage() {
  const staff = await requirePermission("EVENT_MANAGE");
  const organizationId = staff.organizationId!;
  const allowed = staff.eventAccess.map(item => item.eventId);
  const lists = await db.promoterLink.findMany({
    where: {
      event: { organizationId, ...(allowed.length ? { id: { in: allowed } } : {}) },
      promoter: { OR: GUEST_LIST_PREFIXES.map(prefix => ({ name: { startsWith: prefix } })) },
    },
    orderBy: { createdAt: "desc" },
    include: {
      event: true,
      category: true,
      table: true,
      visits: { select: { id: true } },
      orders: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } }, include: { items: true, tickets: true } },
    },
  });

  const totals = lists.reduce((sum, list) => {
    const guests = list.orders.flatMap(order => order.items).reduce((n, item) => n + item.quantity, 0);
    const checkins = list.orders.flatMap(order => order.tickets).filter(ticket => ticket.status === "USED").length;
    return { lists: sum.lists + 1, active: sum.active + (list.active ? 1 : 0), guests: sum.guests + guests, checkins: sum.checkins + checkins, views: sum.views + list.visits.length };
  }, { lists: 0, active: 0, guests: 0, checkins: 0, views: 0 });

  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Guest lists</span><h1>Гостевые списки</h1><p className="muted">Каждый список живёт отдельно: мероприятие, лимит, гости, проходы, просмотры и ссылка управления.</p></div></div>
    <div className="stats">
      <div className="stat"><span className="muted">Списков</span><strong>{totals.lists}</strong></div>
      <div className="stat"><span className="muted">Активных</span><strong>{totals.active}</strong></div>
      <div className="stat"><span className="muted">Гостей</span><strong>{totals.guests}</strong></div>
      <div className="stat"><span className="muted">Прошли</span><strong>{totals.checkins}</strong></div>
      <div className="stat"><span className="muted">Уникальные открытия</span><strong>{totals.views}</strong></div>
    </div>

    <div className="panel" style={{ marginTop: 24, marginBottom: 20 }}><strong>Создание нового списка</strong><p className="muted">Новый список создаётся внутри нужного мероприятия, потому что там уже известны доступные билеты, категории и столы.</p><Link className="btn dark" href="/office/events">Открыть мероприятия</Link></div>

    <div className="table-wrap"><table><thead><tr><th>Список</th><th>Мероприятие</th><th>Назначение</th><th>Заполнено</th><th>Прошли</th><th>Открытия</th><th>Статус</th></tr></thead><tbody>
      {lists.map(list => {
        const guests = list.orders.flatMap(order => order.items).reduce((sum, item) => sum + item.quantity, 0);
        const checkins = list.orders.flatMap(order => order.tickets).filter(ticket => ticket.status === "USED").length;
        const limit = list.guestLimit ?? list.table?.seats ?? list.category?.capacity ?? 0;
        const allocation = list.table ? `Стол: ${list.table.label}` : list.category ? `Билет: ${list.category.name}` : "Мероприятие";
        const fill = limit ? Math.round(guests / limit * 100) : null;
        return <tr key={list.id}>
          <td><Link href={`/office/guest-lists/${list.id}`}><strong>{list.label}</strong></Link><br/><small>{list.code}</small></td>
          <td>{list.event.title}<br/><small>{new Date(list.event.startsAt).toLocaleString("ru-RU")}</small></td>
          <td>{allocation}</td>
          <td><strong>{guests}</strong>{limit ? ` / ${limit}` : ""}{fill !== null && <><br/><small>{fill}% заполнено</small></>}</td>
          <td>{checkins}</td><td>{list.visits.length}</td>
          <td><span className="pill" style={list.active ? { background: "#dcfae6", color: "#067647" } : {}}>{list.active ? "Активен" : "Отключён"}</span></td>
        </tr>;
      })}
      {!lists.length && <tr><td colSpan={7}>Гостевых списков пока нет.</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
