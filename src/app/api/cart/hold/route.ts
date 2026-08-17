import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CART_SESSION_COOKIE, cartHoldOrderId, getHeldInventory, releaseCartHold, replaceCartHold } from "@/lib/cart-hold";
import type { ReservationItemInput } from "@/lib/reservation";

export const dynamic = "force-dynamic";

type CartHoldItem = {
  categoryId: string;
  quantity: number;
  tableId?: string | null;
  seatIds?: string[];
};

function cookieValue(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function cleanItems(value: unknown): CartHoldItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((raw): CartHoldItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.categoryId !== "string") return [];
    const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1));
    const seatIds = Array.isArray(item.seatIds)
      ? item.seatIds.filter((id): id is string => typeof id === "string").slice(0, 20)
      : [];
    return [{
      categoryId: item.categoryId,
      quantity,
      tableId: typeof item.tableId === "string" ? item.tableId : null,
      seatIds,
    }];
  });
}

async function validateAndBuild(eventId: string, items: CartHoldItem[]) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== "PUBLISHED") throw new Error("Мероприятие недоступно для продажи");

  const categoryIds = [...new Set(items.map(item => item.categoryId))];
  const tableIds = [...new Set(items.flatMap(item => item.tableId ? [item.tableId] : []))];
  const seatIds = items.flatMap(item => item.seatIds ?? []);
  if (new Set(seatIds).size !== seatIds.length) throw new Error("Одно место нельзя добавить в корзину дважды");

  const [categories, tables, seats] = await Promise.all([
    categoryIds.length ? db.ticketCategory.findMany({ where: { id: { in: categoryIds } } }) : [],
    tableIds.length ? db.table.findMany({ where: { id: { in: tableIds } }, include: { zone: true, category: true } }) : [],
    seatIds.length ? db.seat.findMany({ where: { id: { in: seatIds } }, include: { category: true, table: { include: { zone: true } } } }) : [],
  ]);

  if (categories.length !== categoryIds.length || categories.some(category => category.eventId !== event.id || category.hidden)) {
    throw new Error("Один из тарифов недоступен");
  }
  if (tables.length !== tableIds.length || tables.some(table => table.zone.eventId !== event.id || table.reserved || table.priceMode !== "WHOLE_TABLE" || !table.category)) {
    throw new Error("Один из выбранных столов больше недоступен");
  }
  if (seats.length !== seatIds.length || seats.some(seat => seat.table.zone.eventId !== event.id || seat.table.priceMode !== "PER_SEAT" || seat.status !== "AVAILABLE" || !seat.category)) {
    throw new Error("Одно из выбранных мест больше недоступно");
  }

  const tableMap = new Map(tables.map(table => [table.id, table]));
  const seatMap = new Map(seats.map(seat => [seat.id, seat]));
  const reservationItems: ReservationItemInput[] = [];

  for (const item of items) {
    if (item.tableId) {
      const table = tableMap.get(item.tableId);
      if (!table?.category) throw new Error("Стол не найден");
      reservationItems.push({ categoryId: table.category.id, quantity: table.seats, tableId: table.id, seatId: null });
      continue;
    }
    if (item.seatIds?.length) {
      if (item.quantity !== item.seatIds.length) throw new Error("Количество мест в позиции изменилось");
      for (const id of item.seatIds) {
        const seat = seatMap.get(id);
        if (!seat?.category) throw new Error("Место не найдено");
        reservationItems.push({ categoryId: seat.category.id, quantity: 1, tableId: null, seatId: seat.id });
      }
      continue;
    }
    reservationItems.push({ categoryId: item.categoryId, quantity: item.quantity, tableId: null, seatId: null });
  }

  const capacities = new Map(categories.map(category => [category.id, {
    sold: category.sold,
    capacity: category.capacity,
    name: category.name,
  }]));
  return { event, categories, reservationItems, capacities };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId") || "";
    if (!eventId) return NextResponse.json({ error: "eventId обязателен" }, { status: 400 });
    const categories = await db.ticketCategory.findMany({ where: { eventId, hidden: false }, select: { id: true } });
    const sessionId = cookieValue(req, CART_SESSION_COOKIE);
    const held = await getHeldInventory({
      categoryIds: categories.map(category => category.id),
      excludeOrderId: sessionId ? cartHoldOrderId(sessionId, eventId) : undefined,
    });
    return NextResponse.json({
      heldSeatIds: held.seatIds,
      heldTableIds: held.tableIds,
      heldByCategory: held.categoryQuantities,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось получить бронь" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { eventId?: unknown; items?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    if (!eventId) throw new Error("eventId обязателен");
    const items = cleanItems(body.items);
    const sessionFromCookie = cookieValue(req, CART_SESSION_COOKIE);
    const sessionId = sessionFromCookie || randomUUID();

    if (!items.length) {
      await db.$transaction(async tx => releaseCartHold({ sessionId, eventId, executor: tx }));
      const response = NextResponse.json({ ok: true, expiresAt: null });
      if (!sessionFromCookie) response.cookies.set(CART_SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
      return response;
    }

    const validated = await validateAndBuild(eventId, items);
    const hold = await db.$transaction(async tx => replaceCartHold({
      sessionId,
      eventId,
      items: validated.reservationItems,
      capacities: validated.capacities,
      executor: tx,
    }));

    const response = NextResponse.json({ ok: true, expiresAt: hold?.expiresAt.toISOString() ?? null });
    if (!sessionFromCookie) response.cookies.set(CART_SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось забронировать билеты" }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId") || "";
    const sessionId = cookieValue(req, CART_SESSION_COOKIE);
    if (!eventId || !sessionId) return NextResponse.json({ ok: true });
    await db.$transaction(async tx => releaseCartHold({ sessionId, eventId, executor: tx }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось снять бронь" }, { status: 400 });
  }
}
