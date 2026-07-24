import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const schema = z
  .object({
    sourceEventId: z.string().min(1),
    title: z.string().trim().min(3).max(160),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/),
    startsAt: z.string().datetime(),
    doorsOpenAt: z.string().datetime(),
    salesStart: z.string().datetime(),
    salesEnd: z.string().datetime(),
    venueName: z.string().trim().min(2).max(160),
    city: z.string().trim().min(2).max(120),
    address: z.string().trim().min(4).max(240),
    copyGuestLists: z.boolean().default(true),
    copyPromoters: z.boolean().default(true),
    copyPromoCodes: z.boolean().default(true),
    copyReferralLinks: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const startsAt = new Date(value.startsAt).getTime();
    const doorsOpenAt = new Date(value.doorsOpenAt).getTime();
    const salesStart = new Date(value.salesStart).getTime();
    const salesEnd = new Date(value.salesEnd).getTime();

    if (doorsOpenAt > startsAt) {
      context.addIssue({ code: "custom", path: ["doorsOpenAt"], message: "Открытие дверей не может быть позже начала мероприятия" });
    }
    if (salesStart >= salesEnd) {
      context.addIssue({ code: "custom", path: ["salesEnd"], message: "Окончание продаж должно быть позже начала продаж" });
    }
    if (salesEnd > startsAt) {
      context.addIssue({ code: "custom", path: ["salesEnd"], message: "Продажи должны завершиться не позже начала мероприятия" });
    }
  });

function newCode(base: string) {
  const safeBase = base.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 24) || "ATLAS";
  return `${safeBase}-${randomBytes(4).toString("hex")}`.toUpperCase();
}

function replaceDoors(description: string, doorsOpenAt: string) {
  const marker = `<!--ATLAS_DOORS_OPEN:${doorsOpenAt}-->`;
  return description.match(/<!--ATLAS_DOORS_OPEN:[^>]+-->/)
    ? description.replace(/<!--ATLAS_DOORS_OPEN:[^>]+-->/, marker)
    : `${description}\n${marker}`;
}

function shiftDate(value: Date | null, milliseconds: number) {
  return value ? new Date(value.getTime() + milliseconds) : null;
}

export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    const actor = await requirePermission("EVENT_MANAGE");
    if (!actor.organizationId) throw new Error("Организация не настроена");

    const existingSlug = await db.event.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (existingSlug) throw new Error("Такой адрес страницы уже используется. Укажите другой slug");

    const source = await db.event.findFirst({
      where: { id: input.sourceEventId, organizationId: actor.organizationId },
      include: {
        categories: { include: { priceTiers: true } },
        zones: { include: { tables: { include: { seatItems: true } } } },
        ticketTemplate: true,
        promoterLinks: { include: { promoter: true } },
        promoCodes: true,
        referrals: true,
        venue: true,
      },
    });
    if (!source) throw new Error("Исходное мероприятие не найдено");

    const newEventStart = new Date(input.startsAt);
    const newSalesStart = new Date(input.salesStart);
    const eventShift = newEventStart.getTime() - source.startsAt.getTime();
    const salesShift = newSalesStart.getTime() - source.salesStart.getTime();

    const result = await db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: input.title,
          slug: input.slug,
          description: replaceDoors(source.description, input.doorsOpenAt),
          posterUrl: source.posterUrl,
          startsAt: newEventStart,
          salesStart: newSalesStart,
          salesEnd: new Date(input.salesEnd),
          status: "DRAFT",
          salesMode: source.salesMode,
          approvalInstructions: source.approvalInstructions,
          mapEnabled: source.mapEnabled,
          mapName: source.mapName,
          organization: { connect: { id: actor.organizationId! } },
          venue: { create: { name: input.venueName, city: input.city, address: input.address } },
        },
      });

      const categoryMap = new Map<string, string>();
      for (const category of source.categories) {
        const created = await tx.ticketCategory.create({
          data: {
            eventId: event.id,
            name: category.name,
            description: category.description,
            priceMinor: category.priceMinor,
            pricingMode: category.pricingMode,
            currency: category.currency,
            capacity: category.capacity,
            sold: 0,
            salesStart: shiftDate(category.salesStart, salesShift) ?? newSalesStart,
            salesEnd: shiftDate(category.salesEnd, salesShift) ?? new Date(input.salesEnd),
            minPerOrder: category.minPerOrder,
            maxPerOrder: category.maxPerOrder,
            hidden: category.hidden,
            colorHex: category.colorHex,
          },
        });
        categoryMap.set(category.id, created.id);

        for (const tier of category.priceTiers) {
          await tx.ticketPriceTier.create({
            data: {
              categoryId: created.id,
              label: tier.label,
              priceMinor: tier.priceMinor,
              startsAt: shiftDate(tier.startsAt, salesShift)!,
              endsAt: shiftDate(tier.endsAt, salesShift)!,
            },
          });
        }
      }

      const tableMap = new Map<string, string>();
      for (const zone of source.zones) {
        const newZone = await tx.zone.create({ data: { eventId: event.id, name: zone.name } });
        for (const table of zone.tables) {
          const newTable = await tx.table.create({
            data: {
              zoneId: newZone.id,
              label: table.label,
              seats: table.seats,
              priceMinor: table.priceMinor,
              priceMode: table.priceMode,
              objectType: table.objectType,
              x: table.x,
              y: table.y,
              rotation: table.rotation,
              width: table.width,
              height: table.height,
              reserved: false,
              categoryId: table.categoryId ? categoryMap.get(table.categoryId) : null,
            },
          });
          tableMap.set(table.id, newTable.id);

          for (const seat of table.seatItems) {
            await tx.seat.create({
              data: {
                tableId: newTable.id,
                label: seat.label,
                position: seat.position,
                status: "AVAILABLE",
                categoryId: seat.categoryId ? categoryMap.get(seat.categoryId) : null,
              },
            });
          }
        }
      }

      if (source.ticketTemplate) {
        await tx.ticketTemplate.create({
          data: {
            eventId: event.id,
            name: source.ticketTemplate.name,
            canvasJson: source.ticketTemplate.canvasJson,
            backgroundColor: source.ticketTemplate.backgroundColor,
            accentColor: source.ticketTemplate.accentColor,
            textColor: source.ticketTemplate.textColor,
            logoUrl: source.ticketTemplate.logoUrl,
            backgroundUrl: source.ticketTemplate.backgroundUrl,
          },
        });
      }

      if (input.copyPromoCodes) {
        for (const promo of source.promoCodes) {
          await tx.promoCode.create({
            data: {
              eventId: event.id,
              code: promo.code,
              discountPercent: promo.discountPercent,
              active: promo.active,
            },
          });
        }
      }

      if (input.copyReferralLinks) {
        for (const referral of source.referrals) {
          await tx.referral.create({
            data: { eventId: event.id, label: referral.label, code: newCode(referral.label) },
          });
        }
      }

      for (const link of source.promoterLinks) {
        const isGuest = link.promoter.name.startsWith("__GUEST_LIST__:");
        if ((isGuest && !input.copyGuestLists) || (!isGuest && !input.copyPromoters)) continue;

        let promoterId = link.promoterId;
        if (isGuest) {
          const promoter = await tx.promoter.create({
            data: {
              organizationId: actor.organizationId!,
              name: `__GUEST_LIST__:${link.label}:${randomBytes(4).toString("hex")}`,
              active: true,
              defaultCommissionBps: 0,
            },
          });
          promoterId = promoter.id;
        }

        await tx.promoterLink.create({
          data: {
            eventId: event.id,
            promoterId,
            label: link.label,
            code: newCode(link.label),
            active: link.active,
            allocationType: link.allocationType,
            guestLimit: link.guestLimit,
            maxPerOrder: link.maxPerOrder,
            customPriceMinor: link.customPriceMinor,
            commissionBps: link.commissionBps,
            exclusive: link.exclusive,
            startsAt: shiftDate(link.startsAt, eventShift),
            endsAt: shiftDate(link.endsAt, eventShift),
            categoryId: link.categoryId ? categoryMap.get(link.categoryId) : null,
            tableId: link.tableId ? tableMap.get(link.tableId) : null,
          },
        });
      }

      return {
        id: event.id,
        categories: source.categories.length,
        zones: source.zones.length,
        promoterLinks: source.promoterLinks.filter((link) => {
          const isGuest = link.promoter.name.startsWith("__GUEST_LIST__:");
          return isGuest ? input.copyGuestLists : input.copyPromoters;
        }).length,
        promoCodes: input.copyPromoCodes ? source.promoCodes.length : 0,
        referralLinks: input.copyReferralLinks ? source.referrals.length : 0,
      };
    });

    await writeAudit(actor, {
      action: "EVENT_CLONED",
      entityType: "Event",
      entityId: result.id,
      summary: `Скопировано мероприятие ${source.title} → ${input.title}`,
      metadata: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Проверьте данные мероприятия" }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка копирования" }, { status: 400 });
  }
}
