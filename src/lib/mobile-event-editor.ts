import { db } from "@/lib/db";
import { describeCategoryPrice } from "@/lib/ticketing";
import { parsePricingMarketingStrategy, withPricingMarketingStrategy, type PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { parseTicketSalesStrategy, withTicketSalesStrategy, type TicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import { parseEventRejectionMessage, withEventRejectionMessage } from "@/lib/event-approval-message";
import { parseBuyerQuestions, withBuyerQuestions, type BuyerQuestion } from "@/lib/buyer-questions";
import { parseGuestFields, serializeGuestFields, stripEventMarkers, type GuestFieldConfig } from "@/lib/event-guest-fields";
import { getEffectiveEventTerms, saveEventTerms } from "@/lib/commercial-terms";
import { archiveDeleteSql, archiveInsertSql, ensureEventArchiveRuntime, isEventArchived } from "@/lib/event-archive";
import { getEventBasics, updateEventBasics, type EventBasicsInput } from "@/lib/event-basics";

export type MobileEditorActor = { id: string; role: string; organizationId: string | null };

type CategoryInput = {
  categoryId?: string;
  name: string;
  description?: string;
  priceMinor: number;
  capacity: number;
  colorHex: string;
  pricingMode: "FIXED" | "SCHEDULED";
  salesStart: string;
  salesEnd: string;
  earlyBirdPriceMinor?: number;
  earlyBirdEndsAt?: string;
  maxPerOrder: number;
  salesStrategy?: TicketSalesStrategy;
};

type LayoutObjectInput = {
  id?: string;
  label: string;
  objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
  seats: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  priceMinor: number;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  categoryId: string | null;
  seatAssignments: Array<{ position: number; categoryId: string | null }>;
};

export async function getMobileEditorState(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      organization: true,
      venue: true,
      categories: { include: { priceTiers: true } },
      zones: { include: { tables: { include: { seatItems: true, orderItems: true } } } },
    },
  });
  if (!event) return null;
  const [basics, commercial, archived] = await Promise.all([
    getEventBasics(eventId),
    getEffectiveEventTerms(eventId, event.organizationId),
    isEventArchived(eventId),
  ]);
  if (!basics) return null;
  const now = new Date();
  const categories = event.categories.map((category) => {
    const price = describeCategoryPrice(category, now);
    return {
      id: category.id,
      name: category.name,
      description: category.description || "",
      priceMinor: category.priceMinor,
      pricingMode: category.pricingMode,
      capacity: category.capacity,
      sold: category.sold,
      hidden: category.hidden,
      colorHex: category.colorHex,
      maxPerOrder: category.maxPerOrder,
      salesStart: category.salesStart?.toISOString() || event.salesStart.toISOString(),
      salesEnd: category.salesEnd?.toISOString() || event.salesEnd.toISOString(),
      priceTiers: category.priceTiers.map((tier) => ({ id: tier.id, label: tier.label, priceMinor: tier.priceMinor, startsAt: tier.startsAt.toISOString(), endsAt: tier.endsAt.toISOString() })),
      currentPriceMinor: price.currentPriceMinor,
      statusLabel: price.statusLabel,
      nextTierPriceMinor: price.nextTier?.priceMinor ?? null,
      nextTierStartsAt: price.nextTier?.startsAt.toISOString() ?? null,
      marketingStrategy: parsePricingMarketingStrategy(category.description),
      salesStrategy: parseTicketSalesStrategy(category.description),
    };
  });
  const layoutObjects = event.zones.flatMap((zone) => zone.tables.map((item) => ({
    id: item.id,
    label: item.label,
    zoneName: zone.name,
    objectType: item.objectType,
    seats: item.seats,
    priceMode: item.priceMode,
    priceMinor: item.priceMinor,
    x: item.x,
    y: item.y,
    rotation: item.rotation,
    width: item.width,
    height: item.height,
    categoryId: item.categoryId,
    reserved: item.reserved || item.orderItems.length > 0 || item.seatItems.some((seat) => seat.status !== "AVAILABLE"),
    seatAssignments: item.seatItems.map((seat) => ({ position: seat.position, categoryId: seat.categoryId })),
  })));
  const guestFields = parseGuestFields(event.description);
  const questions = parseBuyerQuestions(event.description);
  const rejectionMessage = parseEventRejectionMessage(event.description);
  const paidOrders = await db.order.count({ where: { eventId, status: "PAID" } });
  return {
    event: basics,
    tickets: { categories },
    map: {
      enabled: event.mapEnabled,
      name: event.mapName || "Основной зал",
      objects: layoutObjects,
      locked: layoutObjects.some((item) => item.reserved) || paidOrders > 0,
    },
    checkout: {
      salesMode: event.salesMode,
      approvalInstructions: event.approvalInstructions || "",
      rejectionMessage,
      guestFields,
      questions,
      commercial: {
        useOrganizerDefaults: commercial.useOrganizerDefaults,
        serviceFeePayer: commercial.serviceFeePayer,
        organizerServiceFeePayer: commercial.organizer.serviceFeePayer,
        salesFeePercentBps: commercial.organizer.salesFeePercentBps,
        salesFeeFixedMinor: commercial.organizer.salesFeeFixedMinor,
      },
    },
    review: {
      archived,
      status: event.status,
      slug: event.slug,
      mapEnabled: event.mapEnabled,
      categoryCount: event.categories.length,
      sold: event.categories.reduce((sum, item) => sum + item.sold, 0),
      capacity: event.categories.reduce((sum, item) => sum + item.capacity, 0),
    },
  };
}

export async function saveBasics(eventId: string, value: EventBasicsInput, actorId: string) {
  await updateEventBasics(eventId, value, actorId);
}

function validateCategoryTimes(value: CategoryInput) {
  const salesStart = new Date(value.salesStart);
  const salesEnd = new Date(value.salesEnd);
  if (Number.isNaN(salesStart.getTime()) || Number.isNaN(salesEnd.getTime()) || salesStart >= salesEnd) throw new Error("Начало продаж должно быть раньше окончания");
  const earlyEnd = value.earlyBirdEndsAt ? new Date(value.earlyBirdEndsAt) : null;
  if (value.pricingMode === "SCHEDULED" && (value.earlyBirdPriceMinor === undefined || !earlyEnd)) throw new Error("Заполните раннюю цену и дату её окончания");
  if (earlyEnd && (earlyEnd <= salesStart || earlyEnd >= salesEnd)) throw new Error("Дата смены цены должна находиться внутри периода продаж");
  return { salesStart, salesEnd, earlyEnd };
}

export async function createCategory(eventId: string, value: CategoryInput) {
  const parent = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const { salesStart, salesEnd, earlyEnd } = validateCategoryTimes(value);
  const description = withTicketSalesStrategy(value.description || "", value.salesStrategy || "STANDARD");
  await db.ticketCategory.create({
    data: {
      eventId,
      name: value.name,
      description,
      priceMinor: value.priceMinor,
      colorHex: value.colorHex,
      pricingMode: value.pricingMode,
      capacity: value.capacity,
      salesStart: salesStart || parent.salesStart,
      salesEnd: salesEnd || parent.salesEnd,
      maxPerOrder: value.maxPerOrder,
      priceTiers: value.pricingMode === "SCHEDULED" && earlyEnd && value.earlyBirdPriceMinor !== undefined ? { create: [
        { label: "Early Bird", priceMinor: value.earlyBirdPriceMinor, startsAt: salesStart, endsAt: earlyEnd },
        { label: "Standard", priceMinor: value.priceMinor, startsAt: earlyEnd, endsAt: salesEnd },
      ] } : undefined,
    },
  });
}

export async function updateCategory(eventId: string, value: CategoryInput & { categoryId: string }) {
  const existing = await db.ticketCategory.findUniqueOrThrow({ where: { id: value.categoryId } });
  if (existing.eventId !== eventId) throw new Error("Категория не относится к этому мероприятию");
  if (value.capacity < existing.sold) throw new Error(`Уже продано ${existing.sold} билетов - количество нельзя уменьшить ниже этого числа`);
  const { salesStart, salesEnd, earlyEnd } = validateCategoryTimes(value);
  const existingStrategy = parseTicketSalesStrategy(existing.description);
  const description = withTicketSalesStrategy(value.description || "", value.salesStrategy || existingStrategy);
  await db.$transaction([
    db.ticketPriceTier.deleteMany({ where: { categoryId: value.categoryId } }),
    db.ticketCategory.update({
      where: { id: value.categoryId },
      data: {
        name: value.name,
        description,
        colorHex: value.colorHex,
        priceMinor: value.priceMinor,
        capacity: value.capacity,
        pricingMode: value.pricingMode,
        salesStart,
        salesEnd,
        maxPerOrder: value.maxPerOrder,
        priceTiers: value.pricingMode === "SCHEDULED" && earlyEnd && value.earlyBirdPriceMinor !== undefined ? { create: [
          { label: "Early Bird", priceMinor: value.earlyBirdPriceMinor, startsAt: salesStart, endsAt: earlyEnd },
          { label: "Regular", priceMinor: value.priceMinor, startsAt: earlyEnd, endsAt: salesEnd },
        ] } : undefined,
      },
    }),
  ]);
}

export async function setCategoryVisibility(eventId: string, categoryId: string, hidden: boolean) {
  const existing = await db.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } });
  if (existing.eventId !== eventId) throw new Error("Категория не относится к этому мероприятию");
  await db.ticketCategory.update({ where: { id: categoryId }, data: { hidden } });
}

export async function setPricingStrategy(eventId: string, categoryId: string, strategy: PricingMarketingStrategy) {
  const current = await db.ticketCategory.findFirstOrThrow({ where: { id: categoryId, eventId }, select: { description: true } });
  await db.ticketCategory.update({ where: { id: categoryId }, data: { description: withPricingMarketingStrategy(current.description, strategy) } });
}

export async function setAdmissionMode(eventId: string, mapEnabled: boolean) {
  const sold = await db.order.count({ where: { eventId } });
  if (sold) throw new Error("Нельзя менять тип выбора билетов после появления заказов");
  await db.event.update({ where: { id: eventId }, data: { mapEnabled } });
}

export async function saveLayout(eventId: string, objects: LayoutObjectInput[]) {
  await db.$transaction(async (tx) => {
    const categories = await tx.ticketCategory.findMany({ where: { eventId }, select: { id: true } });
    const categoryIds = new Set(categories.map((item) => item.id));
    const sellableTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);
    if (objects.some((item) => item.categoryId && !categoryIds.has(item.categoryId))) throw new Error("Категория билета не относится к этому мероприятию");
    if (objects.some((item) => item.seatAssignments.some((seat) => seat.categoryId && !categoryIds.has(seat.categoryId)))) throw new Error("Категория места не относится к этому мероприятию");
    if (objects.some((item) => sellableTypes.has(item.objectType) && item.seats < 1)) throw new Error("Для продаваемого объекта нужно хотя бы одно место");
    const existing = await tx.table.findMany({ where: { zone: { eventId } }, include: { seatItems: true, orderItems: true } });
    if (existing.some((item) => item.reserved || item.orderItems.length > 0 || item.seatItems.some((seat) => seat.status !== "AVAILABLE"))) throw new Error("Карту нельзя полностью перестроить после появления заказов");
    await tx.seat.deleteMany({ where: { table: { zone: { eventId } } } });
    await tx.table.deleteMany({ where: { zone: { eventId } } });
    let zone = await tx.zone.findUnique({ where: { eventId_name: { eventId, name: "Основной зал" } } });
    zone ??= await tx.zone.create({ data: { eventId, name: "Основной зал" } });
    for (const item of objects) {
      await tx.table.create({
        data: {
          zoneId: zone.id,
          label: item.label,
          objectType: item.objectType,
          seats: item.seats,
          priceMode: item.priceMode,
          priceMinor: item.priceMinor,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          width: item.width,
          height: item.height,
          categoryId: item.categoryId,
          seatItems: { create: Array.from({ length: sellableTypes.has(item.objectType) ? item.seats : 0 }, (_, index) => ({
            label: `${item.label}-${index + 1}`,
            position: index + 1,
            categoryId: item.seatAssignments.find((seat) => seat.position === index + 1)?.categoryId || item.categoryId,
          })) },
        },
      });
    }
  });
}

export async function saveSalesMode(eventId: string, value: { salesMode: "INSTANT" | "APPROVAL_REQUIRED"; approvalInstructions?: string; rejectionMessage?: string }) {
  const current = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { description: true } });
  const description = withEventRejectionMessage(current.description, value.rejectionMessage || parseEventRejectionMessage(current.description));
  await db.event.update({ where: { id: eventId }, data: { salesMode: value.salesMode, approvalInstructions: value.salesMode === "APPROVAL_REQUIRED" ? (value.approvalInstructions?.trim() || null) : null, description } });
}

export async function saveCheckoutForm(eventId: string, guestFields: GuestFieldConfig, questions: BuyerQuestion[]) {
  for (const question of questions) if (question.type === "SELECT" && (!question.options || !question.options.length)) throw new Error(`Добавьте варианты ответа для вопроса «${question.label}»`);
  const current = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { description: true } });
  let description = withBuyerQuestions(current.description, questions);
  description = `${stripEventMarkers(description)}\n${serializeGuestFields(guestFields)}`;
  await db.event.update({ where: { id: eventId }, data: { description } });
}

export async function saveCommercialTerms(eventId: string, actor: MobileEditorActor, value: { useOrganizerDefaults: boolean; serviceFeePayer: "BUYER" | "ORGANIZER" }) {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { organizationId: true } });
  await saveEventTerms(eventId, event.organizationId, actor.id, value);
}

export async function setPublishStatus(eventId: string, status: "DRAFT" | "PUBLISHED") {
  if (await isEventArchived(eventId)) throw new Error("Сначала восстановите мероприятие из архива");
  await db.event.update({ where: { id: eventId }, data: { status } });
}

export async function setArchiveState(eventId: string, actorId: string, action: "archive" | "restore") {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true } });
  await ensureEventArchiveRuntime();
  if (action === "archive") {
    if (await isEventArchived(eventId)) return;
    await db.$transaction(async (tx) => {
      await tx.event.update({ where: { id: eventId }, data: { status: "DRAFT" } });
      await tx.$executeRawUnsafe(archiveInsertSql(), eventId, new Date().toISOString(), actorId, String(event.status));
    });
  } else {
    if (!(await isEventArchived(eventId))) throw new Error("Восстановить можно только архивированное мероприятие");
    await db.$executeRawUnsafe(archiveDeleteSql(), eventId);
  }
}
