import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { guestManagementToken } from "@/lib/guest-links";

const schema = z.object({
  eventId: z.string().min(1),
  displayName: z.string().min(2).max(120),
  allocationType: z.enum(["CATEGORY", "TABLE"]),
  categoryId: z.string().optional().nullable(),
  tableId: z.string().optional().nullable(),
  guestLimit: z.number().int().min(1).max(500),
  code: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).optional(),
});

export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    const actor = await requireEventAccess("EVENT_MANAGE", input.eventId);

    const event = await db.event.findUnique({
      where: { id: input.eventId },
      include: { categories: true, zones: { include: { tables: true } } },
    });
    if (!event) throw new Error("Мероприятие не найдено");

    const category = input.allocationType === "CATEGORY"
      ? event.categories.find((item) => item.id === input.categoryId)
      : null;
    const table = input.allocationType === "TABLE"
      ? event.zones.flatMap((zone) => zone.tables).find((item) => item.id === input.tableId)
      : null;

    if (input.allocationType === "CATEGORY" && !category) throw new Error("Билет не относится к мероприятию");
    if (input.allocationType === "TABLE" && !table) throw new Error("Стол не относится к мероприятию");
    if (category && category.priceMinor !== 0) throw new Error("Для гостевого списка выберите билет с ценой 0");
    if (table && table.categoryId) {
      const tableCategory = event.categories.find((item) => item.id === table.categoryId);
      if (!tableCategory || tableCategory.priceMinor !== 0) throw new Error("Столу должен быть назначен билет с ценой 0");
    }
    if (table && !table.categoryId) throw new Error("Сначала назначьте столу бесплатный билет");
    if (table && input.guestLimit > table.seats) throw new Error(`У этого стола только ${table.seats} мест`);

    const rawCode = input.code?.toUpperCase() || `${input.displayName.replace(/[^A-Za-zА-Яа-я0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20)}-${randomBytes(3).toString("hex")}`.toUpperCase();
    const code = rawCode.replace(/[^A-Z0-9_-]/g, "-");

    const result = await db.$transaction(async (tx) => {
      const promoter = await tx.promoter.create({
        data: {
          organizationId: actor.organizationId!,
          name: `__GUEST_LIST__:${input.displayName}:${randomBytes(4).toString("hex")}`,
          active: true,
          defaultCommissionBps: 0,
        },
      });
      const link = await tx.promoterLink.create({
        data: {
          eventId: input.eventId,
          promoterId: promoter.id,
          label: input.displayName,
          code,
          allocationType: input.allocationType,
          categoryId: input.allocationType === "CATEGORY" ? input.categoryId : null,
          tableId: input.allocationType === "TABLE" ? input.tableId : null,
          guestLimit: input.guestLimit,
          maxPerOrder: 1,
          customPriceMinor: 0,
          commissionBps: 0,
          exclusive: true,
        },
      });
      return link;
    });

    await writeAudit(actor, {
      action: "GUEST_LIST_CREATE",
      entityType: "PromoterLink",
      entityId: result.id,
      summary: `Создан гостевой список ${input.displayName}`,
    });

    const token = guestManagementToken(result.id);
    return NextResponse.json({
      ok: true,
      code: result.code,
      publicPath: `/g/${result.code}`,
      managePath: `/g/${result.code}?token=${token}`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
