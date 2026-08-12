import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parsePricingMarketingStrategy, withPricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";

const payloadSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(500).optional(),
  priceMinor: z.number().int().nonnegative(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  capacity: z.number().int().positive(),
  pricingMode: z.enum(["FIXED", "SCHEDULED"]),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
  earlyBirdPriceMinor: z.number().int().nonnegative().optional(),
  earlyBirdEndsAt: z.string().datetime().optional(),
  maxPerOrder: z.number().int().min(1).max(20),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  try {
    const { id, categoryId } = await params;
    const actor = await requireEventAccess("TICKET_MANAGE", id);
    const value = payloadSchema.parse(await req.json());

    const existing = await db.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } });
    if (existing.eventId !== id) throw new Error("Категория не относится к этому мероприятию");

    const parent = await db.event.findUniqueOrThrow({ where: { id }, select: { salesStart: true, salesEnd: true } });
    const salesStart = value.salesStart ? new Date(value.salesStart) : (existing.salesStart ?? parent.salesStart);
    const salesEnd = value.salesEnd ? new Date(value.salesEnd) : (existing.salesEnd ?? parent.salesEnd);
    if (salesStart >= salesEnd) throw new Error("Начало продаж должно быть раньше окончания");
    if (value.capacity < existing.sold) throw new Error(`Уже продано ${existing.sold} билетов - количество нельзя уменьшить ниже этого числа`);
    if (value.pricingMode === "SCHEDULED" && (value.earlyBirdPriceMinor === undefined || !value.earlyBirdEndsAt)) throw new Error("Заполните раннюю цену и дату её окончания");

    const earlyEnd = value.earlyBirdEndsAt ? new Date(value.earlyBirdEndsAt) : null;
    if (earlyEnd && (earlyEnd <= salesStart || earlyEnd >= salesEnd)) throw new Error("Дата смены цены должна находиться внутри периода продаж");

    const marketingStrategy = parsePricingMarketingStrategy(existing.description);
    const description = withPricingMarketingStrategy(value.description?.trim() || null, marketingStrategy);

    const updated = await db.$transaction(async (tx) => {
      await tx.ticketPriceTier.deleteMany({ where: { categoryId } });
      await tx.ticketCategory.update({
        where: { id: categoryId },
        data: {
          name: value.name.trim(),
          description,
          colorHex: value.colorHex,
          priceMinor: value.priceMinor,
          capacity: value.capacity,
          pricingMode: value.pricingMode,
          salesStart,
          salesEnd,
          maxPerOrder: value.maxPerOrder,
          priceTiers: value.pricingMode === "SCHEDULED" && earlyEnd && value.earlyBirdPriceMinor !== undefined ? {
            create: [
              { label: "Early bird", priceMinor: value.earlyBirdPriceMinor, startsAt: salesStart, endsAt: earlyEnd },
              { label: "Regular", priceMinor: value.priceMinor, startsAt: earlyEnd, endsAt: salesEnd },
            ],
          } : undefined,
        },
      });
      return tx.ticketCategory.findUniqueOrThrow({ where: { id: categoryId }, include: { priceTiers: true } });
    });

    if (updated.name !== value.name.trim() || updated.colorHex.toLowerCase() !== value.colorHex.toLowerCase() || updated.capacity !== value.capacity || updated.priceMinor !== value.priceMinor) {
      throw new Error("Изменения билета не подтвердились после сохранения");
    }

    await writeAudit(actor, {
      action: "EVENT_CATEGORY_UPDATE",
      entityType: "Event",
      entityId: id,
      summary: `Обновлён билет: ${updated.name}`,
      metadata: { categoryId },
    });

    return NextResponse.json({
      ok: true,
      category: {
        id: updated.id,
        name: updated.name,
        description: value.description?.trim() || "",
        priceMinor: updated.priceMinor,
        pricingMode: updated.pricingMode,
        capacity: updated.capacity,
        sold: updated.sold,
        hidden: updated.hidden,
        colorHex: updated.colorHex,
        maxPerOrder: updated.maxPerOrder,
        salesStart: updated.salesStart?.toISOString() ?? null,
        salesEnd: updated.salesEnd?.toISOString() ?? null,
        priceTiers: updated.priceTiers.map((tier) => ({ id: tier.id, label: tier.label, priceMinor: tier.priceMinor, startsAt: tier.startsAt.toISOString(), endsAt: tier.endsAt.toISOString() })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
