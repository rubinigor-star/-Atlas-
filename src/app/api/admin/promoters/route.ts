import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const promoterSchema = z.object({
  action: z.literal("promoter"),
  name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  commissionPercent: z.number().min(0).max(100).default(0),
});

const linkSchema = z.object({
  action: z.literal("link"),
  eventId: z.string().min(1),
  promoterId: z.string().min(1),
  label: z.string().min(2).max(120),
  code: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/),
  allocationType: z.enum(["EVENT", "CATEGORY", "TABLE"]),
  categoryId: z.string().optional().nullable(),
  tableId: z.string().optional().nullable(),
  guestLimit: z.number().int().positive().optional().nullable(),
  maxPerOrder: z.number().int().min(1).max(50).default(10),
  customPriceMinor: z.number().int().positive().optional().nullable(),
  commissionPercent: z.number().min(0).max(100).default(0),
  exclusive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

const toggleSchema = z.object({
  action: z.literal("toggle"),
  linkId: z.string().min(1),
  active: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "promoter") {
      const input = promoterSchema.parse(body);
      const actor = await requirePermission("EVENT_MANAGE");
      if (!actor.organizationId) throw new Error("FORBIDDEN");
      const promoter = await db.promoter.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          defaultCommissionBps: Math.round(input.commissionPercent * 100),
        },
      });
      await writeAudit(actor, { action: "PROMOTER_CREATE", entityType: "Promoter", entityId: promoter.id, summary: `Создан промоутер ${promoter.name}` });
      return NextResponse.json({ ok: true, id: promoter.id }, { status: 201 });
    }

    if (body.action === "link") {
      const input = linkSchema.parse(body);
      const actor = await requireEventAccess("EVENT_MANAGE", input.eventId);
      const promoter = await db.promoter.findFirst({ where: { id: input.promoterId, organizationId: actor.organizationId! } });
      if (!promoter) throw new Error("Промоутер не найден");

      if (input.allocationType === "CATEGORY") {
        const category = await db.ticketCategory.findFirst({ where: { id: input.categoryId || "", eventId: input.eventId } });
        if (!category) throw new Error("Категория не относится к мероприятию");
      }
      if (input.allocationType === "TABLE") {
        const table = await db.table.findFirst({ where: { id: input.tableId || "", zone: { eventId: input.eventId } } });
        if (!table) throw new Error("Стол не относится к мероприятию");
      }
      if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) throw new Error("Дата окончания должна быть позже даты начала");

      const link = await db.promoterLink.create({
        data: {
          eventId: input.eventId,
          promoterId: input.promoterId,
          label: input.label,
          code: input.code.toUpperCase(),
          allocationType: input.allocationType,
          categoryId: input.allocationType === "CATEGORY" ? input.categoryId : null,
          tableId: input.allocationType === "TABLE" ? input.tableId : null,
          guestLimit: input.guestLimit ?? null,
          maxPerOrder: input.maxPerOrder,
          customPriceMinor: input.customPriceMinor ?? null,
          commissionBps: Math.round(input.commissionPercent * 100),
          exclusive: input.exclusive,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        },
      });
      await writeAudit(actor, { action: "PROMOTER_LINK_CREATE", entityType: "PromoterLink", entityId: link.id, summary: `Создана ссылка ${link.label}` });
      return NextResponse.json({ ok: true, id: link.id }, { status: 201 });
    }

    if (body.action === "toggle") {
      const input = toggleSchema.parse(body);
      const existing = await db.promoterLink.findUnique({ where: { id: input.linkId }, select: { eventId: true } });
      if (!existing) throw new Error("Ссылка не найдена");
      const actor = await requireEventAccess("EVENT_MANAGE", existing.eventId);
      await db.promoterLink.update({ where: { id: input.linkId }, data: { active: input.active } });
      await writeAudit(actor, { action: input.active ? "PROMOTER_LINK_ENABLE" : "PROMOTER_LINK_DISABLE", entityType: "PromoterLink", entityId: input.linkId, summary: input.active ? "Ссылка включена" : "Ссылка отключена" });
      return NextResponse.json({ ok: true });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
