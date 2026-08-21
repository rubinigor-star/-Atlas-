import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ExternalTicketImportManager } from "@/components/external-ticket-import-manager";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
import { ensureExternalCustomerProfileColumns } from "@/lib/external-customer-profiles";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";

export const dynamic = "force-dynamic";

type SourceRow = {
  id: string;
  name: string;
  sourceKey: string;
  platformKey: string | null;
  total: number | bigint;
  used: number | bigint;
  cancelled: number | bigint;
  lastImportedAt: Date | string | null;
};

type ImportedTicketRow = {
  id: string;
  externalTicketId: string;
  externalOrderId: string | null;
  holderName: string | null;
  phone: string | null;
  email: string | null;
  ticketType: string | null;
  status: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: Date | string | null;
  city: string | null;
  gender: string | null;
};

type IntegrationRow = { enabled: boolean; credentialsEncrypted: string | null };

function genderLabel(value: string | null) {
  if (value === "MALE") return "Мужчина";
  if (value === "FEMALE") return "Женщина";
  return "-";
}

function dateLabel(value: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export default async function ExternalTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  await requireEventAccess("TICKET_MANAGE", eventId);
  await Promise.all([ensureExternalTicketStorage(), ensureOrganizationIntegrationsTable(), ensureExternalCustomerProfileColumns()]);
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, organizationId: true } });
  if (!event) notFound();

  const [rows, valueCardRows, importedTickets] = await Promise.all([
    db.$queryRawUnsafe<SourceRow[]>(
      `SELECT s."id",s."name",s."sourceKey",s."platformKey",
        (SELECT COUNT(*) FROM "ExternalTicket" t WHERE t."sourceId"=s."id") AS "total",
        (SELECT COUNT(*) FROM "ExternalTicket" t WHERE t."sourceId"=s."id" AND t."status"='USED') AS "used",
        (SELECT COUNT(*) FROM "ExternalTicket" t WHERE t."sourceId"=s."id" AND t."status"='CANCELLED') AS "cancelled",
        (SELECT MAX(b."importedAt") FROM "ExternalTicketImportBatch" b WHERE b."sourceId"=s."id") AS "lastImportedAt"
       FROM "ExternalTicketSource" s
       WHERE s."eventId"=$1
       ORDER BY s."createdAt" ASC`,
      eventId,
    ),
    db.$queryRawUnsafe<IntegrationRow[]>(
      `SELECT "enabled","credentialsEncrypted" FROM "OrganizationIntegration" WHERE "organizationId"=$1 AND "provider"='VALUECARD' LIMIT 1`,
      event.organizationId,
    ),
    db.$queryRawUnsafe<ImportedTicketRow[]>(
      `SELECT t."id",t."externalTicketId",t."externalOrderId",t."holderName",t."phone",t."email",t."ticketType",t."status",
              c."firstName",c."lastName",c."birthDate",c."city",c."gender"
       FROM "ExternalTicket" t
       LEFT JOIN "ExternalCustomer" c ON c."id"=t."customerId"
       WHERE t."eventId"=$1
       ORDER BY t."createdAt" DESC, t."externalOrderId" NULLS LAST, t."externalTicketId"
       LIMIT 250`,
      eventId,
    ),
  ]);

  const sources = rows.map((row) => ({
    id: row.id,
    name: row.name,
    sourceKey: row.sourceKey,
    platformKey: row.platformKey,
    total: Number(row.total || 0),
    used: Number(row.used || 0),
    cancelled: Number(row.cancelled || 0),
    lastImportedAt: row.lastImportedAt ? new Date(row.lastImportedAt).toISOString() : null,
  }));
  const valueCardEnabled = Boolean(valueCardRows[0]?.enabled && valueCardRows[0]?.credentialsEncrypted);

  return <AdminShell>
    <div className="row between" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div><span className="eyebrow">Imported tickets</span><h1>Внешние продажи</h1><p className="muted">{event.title} · Atlas Scanner принимает родные и импортированные билеты одним потоком.</p></div>
      <Link className="btn secondary" href={`/office/events/${eventId}?tab=tickets`}>Назад к билетам</Link>
    </div>
    <ExternalTicketImportManager eventId={eventId} sources={sources} valueCardEnabled={valueCardEnabled}/>

    <section className="panel stack" style={{ marginTop: 18 }}>
      <div><span className="eyebrow">Сохранено в Atlas</span><h2>Загруженные билеты</h2><p className="muted">Это read-only записи. Их импорт не запускает оплату, approve, отправку билетов или рассылки Atlas. Показано {importedTickets.length} записей.</p></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Имя</th><th>Фамилия</th><th>Телефон</th><th>Email</th><th>Дата рождения</th><th>Город</th><th>Пол</th><th>Заказ</th><th>Билет / Barcode</th><th>Статус</th></tr></thead>
          <tbody>
            {importedTickets.map((ticket) => <tr key={ticket.id}>
              <td>{ticket.firstName || ticket.holderName?.trim().split(/\s+/)[0] || "-"}</td>
              <td>{ticket.lastName || ticket.holderName?.trim().split(/\s+/).slice(1).join(" ") || "-"}</td>
              <td>{ticket.phone || "-"}</td>
              <td>{ticket.email || "-"}</td>
              <td>{dateLabel(ticket.birthDate)}</td>
              <td>{ticket.city || "-"}</td>
              <td>{genderLabel(ticket.gender)}</td>
              <td>{ticket.externalOrderId || "-"}</td>
              <td><strong>{ticket.externalTicketId}</strong></td>
              <td><span className="pill">{ticket.status}</span></td>
            </tr>)}
            {!importedTickets.length && <tr><td colSpan={10}>Импортированных билетов пока нет.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </AdminShell>;
}
