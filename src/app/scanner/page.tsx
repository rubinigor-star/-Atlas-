import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ScannerClient } from "@/components/scanner-client";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function Scanner() {
  const staff = await requirePermission("SCAN");
  const allowedEvents = staff.eventAccess.map((item) => item.eventId);
  const eventFilter = {
    organizationId: staff.organizationId!,
    ...(allowedEvents.length ? { id: { in: allowedEvents } } : {}),
  };

  const [events, scans] = await Promise.all([
    db.event.findMany({
      where: eventFilter,
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        startsAt: true,
        categories: { select: { capacity: true } },
      },
    }),
    db.scan.findMany({
      where: { ticket: { order: { event: eventFilter } } },
      take: 20,
      orderBy: { scannedAt: "desc" },
      include: { ticket: { include: { category: true, order: { include: { event: true } } } } },
    }),
  ]);

  const eventOptions = await Promise.all(events.map(async (event) => {
    const [sold, entered] = await Promise.all([
      db.ticket.count({ where: { order: { eventId: event.id, status: "PAID" } } }),
      db.ticket.count({ where: { status: "USED", order: { eventId: event.id, status: "PAID" } } }),
    ]);
    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      capacity: event.categories.reduce((sum, category) => sum + category.capacity, 0),
      sold,
      entered,
    };
  }));

  const totalEntered = eventOptions.reduce((sum, event) => sum + event.entered, 0);

  return <AdminShell>
    <div className="office-page-heading">
      <div>
        <span className="eyebrow">Door control</span>
        <h1>Сканер билетов</h1>
        <p>Мобильный контроль входа, статистика мероприятия и быстрый поиск гостя.</p>
      </div>
      <span className="office-live"><i/>Вошли: {totalEntered}</span>
    </div>

    <div className="office-scanner">
      <ScannerClient initialEntered={totalEntered} events={eventOptions}/>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Время</th><th>Результат</th><th>Гость</th><th>Категория</th><th>Мероприятие</th><th>Код</th></tr></thead>
          <tbody>{scans.map((scan) => <tr key={scan.id}>
            <td>{scan.scannedAt.toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem" })}</td>
            <td><span className="pill">{scan.result}</span></td>
            <td>{scan.ticket?.holderName ?? "-"}</td>
            <td>{scan.ticket?.category.name ?? "-"}</td>
            <td>{scan.ticket?.order.event.title ?? "-"}</td>
            <td>{scan.ticket?.publicCode.slice(0, 16) ?? "-"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </AdminShell>;
}
