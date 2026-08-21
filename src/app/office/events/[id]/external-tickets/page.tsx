import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ExternalTicketImportManager } from "@/components/external-ticket-import-manager";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
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

type IntegrationRow = { enabled: boolean; credentialsEncrypted: string | null };

export default async function ExternalTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  await requireEventAccess("TICKET_MANAGE", eventId);
  await Promise.all([ensureExternalTicketStorage(), ensureOrganizationIntegrationsTable()]);
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, organizationId: true } });
  if (!event) notFound();

  const [rows, valueCardRows] = await Promise.all([
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
      <div><span className="eyebrow">Ticket Sources</span><h1>Внешние продажи</h1><p className="muted">{event.title} · Atlas Scanner принимает родные и импортированные билеты одним потоком.</p></div>
      <Link className="btn secondary" href={`/office/events/${eventId}?tab=tickets`}>Назад к билетам</Link>
    </div>
    <ExternalTicketImportManager eventId={eventId} sources={sources} valueCardEnabled={valueCardEnabled}/>
  </AdminShell>;
}
