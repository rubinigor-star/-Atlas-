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

  const [events, entered, scans] = await Promise.all([
    db.event.findMany({
      where: eventFilter,
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true },
    }),
    db.ticket.count({
      where: { status: "USED", order: { status: "PAID", event: eventFilter } },
    }),
    db.scan.findMany({
      where: { ticket: { order: { event: eventFilter } } },
      take: 20,
      orderBy: { scannedAt: "desc" },
      include: { ticket: { include: { category: true, order: { include: { event: true } } } } },
    }),
  ]);

  return <AdminShell>
    <div className="office-page-heading">
      <div>
        <span className="eyebrow">Door control</span>
        <h1>Сканер билетов</h1>
        <p>Непрерывная камера, ручной ввод, звуковая индикация и журнал входов.</p>
      </div>
      <span className="office-live"><i/>Вошли: {entered}</span>
    </div>

    <div className="office-scanner">
      <ScannerClient
        initialEntered={entered}
        events={events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt.toISOString() }))}
      />

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
