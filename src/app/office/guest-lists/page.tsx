import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUEST_LIST_PREFIX = "__GUEST_LIST__:";

export default async function GuestListsPage() {
  const staff = await requirePermission("EVENT_MANAGE");
  const organizationId = staff.organizationId!;
  const lists = await db.promoterLink.findMany({
    where: {
      event: { organizationId },
      promoter: { name: { startsWith: GUEST_LIST_PREFIX } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      event: true,
      category: true,
      table: true,
      visits: { select: { id: true } },
      orders: {
        where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
        include: { items: true, tickets: true },
      },
    },
  });

  return <AdminShell>
    <div className="office-page-heading">
      <div>
        <span className="eyebrow">Guest lists</span>
        <h1>Гостевые списки</h1>
        <p>Временные списки для именинников, столов, артистов и приглашённых гостей. Для них не создаются аккаунты промоутеров.</p>
      </div>
    </div>

    <div className="panel" style={{ marginBottom: 20 }}>
      <strong>Как создать новый список</strong>
      <p className="muted">Откройте нужное мероприятие и используйте блок «Гостевые списки». Там можно выбрать бесплатный билет или конкретный стол, задать лимит и получить ссылку управления.</p>
      <Link className="btn dark" href="/office/events/new">Открыть мероприятия</Link>
    </div>

    <div className="table-wrap"><table><thead><tr><th>Список</th><th>Мероприятие</th><th>Назначение</th><th>Гости</th><th>Проходы</th><th>Просмотры</th><th>Ссылка</th></tr></thead><tbody>
      {lists.map((list) => {
        const guests = list.orders.flatMap((order) => order.items).reduce((sum, item) => sum + item.quantity, 0);
        const checkins = list.orders.flatMap((order) => order.tickets).filter((ticket) => ticket.status === "USED").length;
        const limit = list.guestLimit ?? list.table?.seats ?? list.category?.capacity ?? 0;
        const allocation = list.table ? `Стол: ${list.table.label}` : list.category ? `Билет: ${list.category.name}` : "Мероприятие";
        return <tr key={list.id}>
          <td><strong>{list.label}</strong><br /><small>{list.active ? "Активен" : "Отключён"}</small></td>
          <td>{list.event.title}<br /><small>{new Date(list.event.startsAt).toLocaleString("ru-RU")}</small></td>
          <td>{allocation}</td>
          <td><strong>{guests}</strong>{limit ? ` из ${limit}` : ""}</td>
          <td>{checkins}</td>
          <td>{list.visits.length}</td>
          <td><Link href={`/g/${list.code}`} target="_blank">/g/{list.code}</Link><br /><Link href={`/office/events/${list.eventId}`}>Управлять в мероприятии</Link></td>
        </tr>;
      })}
      {!lists.length && <tr><td colSpan={7}>Гостевых списков пока нет. Создайте бесплатный билет, затем откройте мероприятие и добавьте список.</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
