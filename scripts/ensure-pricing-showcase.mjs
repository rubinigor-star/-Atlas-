import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PREFIX = "test-pricing-";

function strategyMarker(strategy) {
  const encoded = Buffer.from(JSON.stringify(strategy), "utf8").toString("base64url");
  return `<!--ATLAS_PRICING_STRATEGY:${encoded}-->`;
}

function description(text, strategy) {
  return `${text}\n${strategyMarker(strategy)}`;
}

const strategies = {
  calm: { intensity: "CALM", showCountdown: false, showNextPrice: false, showStageRemaining: false, showTotalRemaining: false, showSoldCount: false },
  countdown: { intensity: "STANDARD", showCountdown: true, showNextPrice: true, showStageRemaining: false, showTotalRemaining: false, showSoldCount: false },
  lowStock: { intensity: "ACTIVE", showCountdown: false, showNextPrice: false, showStageRemaining: true, showTotalRemaining: true, showSoldCount: false },
  socialProof: { intensity: "ACTIVE", showCountdown: false, showNextPrice: false, showStageRemaining: false, showTotalRemaining: false, showSoldCount: true },
  maximum: { intensity: "MAXIMUM", showCountdown: true, showNextPrice: true, showStageRemaining: true, showTotalRemaining: true, showSoldCount: true },
};

const now = new Date();
const eventStart = new Date(now.getTime() + 90 * 86400000);
const salesEnd = new Date(eventStart.getTime() - 3 * 3600000);
const tierStart = new Date(now.getTime() - 86400000);
const soon = new Date(now.getTime() + 2 * 86400000);
const later = new Date(now.getTime() + 30 * 86400000);

async function ensureEvent({ slug, title, categories }) {
  const organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) {
    console.log("Pricing showcase skipped: no organization exists.");
    return;
  }

  let venue = await db.venue.findFirst({ where: { name: "Atlas Pricing Lab" } });
  if (!venue) {
    venue = await db.venue.create({ data: { name: "Atlas Pricing Lab", city: "Tel Aviv", address: "Preview environment" } });
  }

  const event = await db.event.upsert({
    where: { slug },
    update: {
      title,
      description: "Тестовое мероприятие для визуальной проверки ценовых стратегий Atlas.",
      startsAt: eventStart,
      salesStart: tierStart,
      salesEnd,
      status: "PUBLISHED",
      salesMode: "INSTANT",
      mapEnabled: false,
      organizationId: organization.id,
      venueId: venue.id,
    },
    create: {
      slug,
      title,
      description: "Тестовое мероприятие для визуальной проверки ценовых стратегий Atlas.",
      posterUrl: "/assets/noa-live-tel-aviv.png",
      startsAt: eventStart,
      salesStart: tierStart,
      salesEnd,
      status: "PUBLISHED",
      salesMode: "INSTANT",
      mapEnabled: false,
      organizationId: organization.id,
      venueId: venue.id,
    },
  });

  await db.ticketPriceTier.deleteMany({ where: { category: { eventId: event.id } } });
  await db.ticketCategory.deleteMany({ where: { eventId: event.id } });

  for (const category of categories) {
    await db.ticketCategory.create({
      data: {
        name: category.name,
        description: description(category.text, category.strategy),
        priceMinor: category.priceMinor,
        pricingMode: category.tiers?.length ? "SCHEDULED" : "FIXED",
        capacity: category.capacity,
        sold: category.sold,
        colorHex: category.colorHex,
        eventId: event.id,
        priceTiers: category.tiers?.length ? { create: category.tiers } : undefined,
      },
    });
  }

  console.log(`Pricing showcase ready: /events/${slug}`);
}

try {
  await ensureEvent({
    slug: `${PREFIX}fixed-calm`,
    title: "TEST PRICE 01 - Fixed Calm",
    categories: [{ name: "Regular", text: "Обычная фиксированная цена без давления.", strategy: strategies.calm, priceMinor: 9900, capacity: 200, sold: 18, colorHex: "#2563EB" }],
  });

  await ensureEvent({
    slug: `${PREFIX}scheduled-soon`,
    title: "TEST PRICE 02 - Price Rises Soon",
    categories: [{ name: "Early Price", text: "Текущая цена и ближайшее повышение по времени.", strategy: strategies.countdown, priceMinor: 11900, capacity: 200, sold: 44, colorHex: "#7C3AED", tiers: [
      { label: "Early Bird", priceMinor: 11900, startsAt: tierStart, endsAt: soon },
      { label: "Regular", priceMinor: 13900, startsAt: soon, endsAt: later },
    ] }],
  });

  await ensureEvent({
    slug: `${PREFIX}low-stock`,
    title: "TEST PRICE 03 - Only 5 Left",
    categories: [{ name: "Last 5 at this price", text: "Проверка заметного, но честного отображения малого остатка.", strategy: strategies.lowStock, priceMinor: 12900, capacity: 50, sold: 45, colorHex: "#D97706" }],
  });

  await ensureEvent({
    slug: `${PREFIX}social-proof`,
    title: "TEST PRICE 04 - Popular Ticket",
    categories: [{ name: "Popular", text: "Показывается количество уже купленных билетов.", strategy: strategies.socialProof, priceMinor: 14900, capacity: 500, sold: 327, colorHex: "#059669" }],
  });

  await ensureEvent({
    slug: `${PREFIX}maximum`,
    title: "TEST PRICE 05 - Maximum Urgency",
    categories: [{ name: "Final Release", text: "Одновременно показываются таймер, следующая цена, остаток и продажи.", strategy: strategies.maximum, priceMinor: 15900, capacity: 120, sold: 109, colorHex: "#DC2626", tiers: [
      { label: "Final Release", priceMinor: 15900, startsAt: tierStart, endsAt: soon },
      { label: "Door Price", priceMinor: 18900, startsAt: soon, endsAt: later },
    ] }],
  });

  await ensureEvent({
    slug: `${PREFIX}mixed`,
    title: "TEST PRICE 06 - Mixed Categories",
    categories: [
      { name: "Dance Floor", text: "Спокойная фиксированная цена.", strategy: strategies.calm, priceMinor: 9900, capacity: 400, sold: 121, colorHex: "#2563EB" },
      { name: "Golden Ring", text: "Цена скоро повысится.", strategy: strategies.countdown, priceMinor: 14900, capacity: 120, sold: 76, colorHex: "#9333EA", tiers: [
        { label: "Release 2", priceMinor: 14900, startsAt: tierStart, endsAt: soon },
        { label: "Release 3", priceMinor: 16900, startsAt: soon, endsAt: later },
      ] },
      { name: "VIP", text: "Малый остаток и число продаж.", strategy: { ...strategies.lowStock, showSoldCount: true }, priceMinor: 24900, capacity: 40, sold: 36, colorHex: "#D97706" },
    ],
  });
} finally {
  await db.$disconnect();
}
