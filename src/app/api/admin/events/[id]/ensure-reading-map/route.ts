import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { isReadingVenue, readingVenuePreset } from "@/lib/venue-map-presets";

const sellableTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireEventAccess("EVENT_MANAGE", id);

    const event = await db.event.findUnique({
      where: { id },
      include: {
        venue: true,
        zones: { include: { tables: { select: { id: true } } } },
      },
    });

    if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
    if (!event.mapEnabled) return NextResponse.json({ created: false, reason: "map-disabled" });
    if (!isReadingVenue(event.venue.name)) return NextResponse.json({ created: false, reason: "not-reading-3" });

    const hasMap = event.zones.some((zone) => zone.tables.length > 0);
    if (hasMap) return NextResponse.json({ created: false, reason: "map-exists" });

    const preset = readingVenuePreset();

    await db.$transaction(async (tx) => {
      let zone = await tx.zone.findUnique({ where: { eventId_name: { eventId: id, name: "Основной зал" } } });
      zone ??= await tx.zone.create({ data: { eventId: id, name: "Основной зал" } });

      for (const item of preset) {
        await tx.table.create({
          data: {
            zoneId: zone.id,
            label: item.label,
            objectType: item.objectType,
            seats: item.seats,
            priceMode: item.priceMode,
            priceMinor: 0,
            x: item.x,
            y: item.y,
            rotation: item.rotation,
            width: item.width,
            height: item.height,
            categoryId: null,
            seatItems: sellableTypes.has(item.objectType)
              ? {
                  create: Array.from({ length: item.seats }, (_, index) => ({
                    label: `${item.label}-${index + 1}`,
                    position: index + 1,
                    categoryId: null,
                  })),
                }
              : undefined,
          },
        });
      }
    });

    return NextResponse.json({ created: true, venue: event.venue.name });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Недостаточно прав" : error instanceof Error ? error.message : "Не удалось создать карту Reading 3" },
      { status: forbidden ? 403 : 400 },
    );
  }
}
