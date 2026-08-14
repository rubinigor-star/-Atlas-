import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { encryptIntegrationSecret } from "@/lib/integration-secrets";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";
import { writeAudit } from "@/lib/audit";

type IntegrationRow = {
  id: string;
  enabled: number | boolean;
  credentialsEncrypted: string | null;
  lastTestStatus: string | null;
  lastTestedAt: Date | string | null;
};

const updateSchema = z.object({
  enabled: z.boolean(),
  token: z.string().trim().min(8).max(4000).optional(),
});

async function getValueCard(organizationId: string) {
  await ensureOrganizationIntegrationsTable();
  const rows = await db.$queryRaw<IntegrationRow[]>`
    SELECT "id", "enabled", "credentialsEncrypted", "lastTestStatus", "lastTestedAt"
    FROM "OrganizationIntegration"
    WHERE "organizationId" = ${organizationId} AND "provider" = 'VALUECARD'
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET() {
  try {
    const actor = await requirePermission("TEAM_MANAGE");
    const integration = await getValueCard(actor.organizationId!);
    return NextResponse.json({
      enabled: Boolean(integration?.enabled),
      configured: Boolean(integration?.credentialsEncrypted),
      lastTestStatus: integration?.lastTestStatus || null,
      lastTestedAt: integration?.lastTestedAt || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("TEAM_MANAGE");
    const input = updateSchema.parse(await request.json());
    const existing = await getValueCard(actor.organizationId!);
    const encrypted = input.token ? encryptIntegrationSecret(input.token) : existing?.credentialsEncrypted || null;
    if (input.enabled && !encrypted) {
      return NextResponse.json({ error: "Сначала укажите ValueCard API token" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = existing?.id || randomUUID();
    await db.$executeRaw`
      INSERT INTO "OrganizationIntegration" ("id", "organizationId", "provider", "enabled", "credentialsEncrypted", "createdAt", "updatedAt")
      VALUES (${id}, ${actor.organizationId!}, 'VALUECARD', ${input.enabled}, ${encrypted}, ${now}, ${now})
      ON CONFLICT("organizationId", "provider") DO UPDATE SET
        "enabled" = excluded."enabled",
        "credentialsEncrypted" = excluded."credentialsEncrypted",
        "updatedAt" = excluded."updatedAt"
    `;

    await writeAudit(actor, {
      action: "INTEGRATION_UPDATED",
      entityType: "OrganizationIntegration",
      entityId: id,
      summary: `ValueCard ${input.enabled ? "подключён" : "отключён"}`,
      metadata: JSON.stringify({ provider: "VALUECARD", tokenUpdated: Boolean(input.token) }),
    });

    return NextResponse.json({ enabled: input.enabled, configured: Boolean(encrypted) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    const friendly = message === "INTEGRATIONS_ENCRYPTION_KEY_NOT_CONFIGURED"
      ? "На сервере не настроен INTEGRATIONS_ENCRYPTION_KEY"
      : message === "FORBIDDEN" ? "Недостаточно прав" : message;
    return NextResponse.json({ error: friendly }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
