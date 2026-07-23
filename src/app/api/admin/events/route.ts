import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createEventSchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const input = createEventSchema.parse(body);
    const actor = await requirePermission("EVENT_MANAGE");
    if (!actor.organizationId) throw new Error("Организация не настроена");
    const posterUrl =
      typeof body === "object" && body && "posterUrl" in body && typeof body.posterUrl === "string"
        ? body.posterUrl
        : "/assets/noa-live-tel-aviv.png";

    // Persist doors opening time without blocking the current production schema.
    // A dedicated Event field will replace this metadata marker in the next schema migration.
    const description = `${input.description}\n<!--ATLAS_DOORS_OPEN:${input.doorsOpenAt}-->`;

    const event = await db.event.create({
      data: {
        title: input.title,
        slug: input.slug,
        description,
        posterUrl,
        startsAt: new Date(input.startsAt),
        salesStart: new Date(input.salesStart),
        salesEnd: new Date(input.salesEnd),
        status: "DRAFT",
        salesMode: input.salesMode,
        mapEnabled: input.mapEnabled,
        approvalInstructions: input.approvalInstructions || null,
        organization: { connect: { id: actor.organizationId } },
        venue: {
          create: {
            name: input.venueName,
            city: input.city,
            address: input.address,
          },
        },
        categories: {
          create: {
            name: input.categoryName,
            description: input.categoryDescription || null,
            colorHex: input.categoryColor,
            priceMinor: input.priceMinor,
            pricingMode: input.pricingMode,
            capacity: input.capacity,
            salesStart: new Date(input.salesStart),
            salesEnd: new Date(input.salesEnd),
            maxPerOrder: input.maxPerOrder,
            priceTiers: input.pricingMode === "SCHEDULED" && input.earlyBirdPriceMinor !== undefined && input.earlyBirdEndsAt ? {
              create: [
                { label: "Early bird", priceMinor: input.earlyBirdPriceMinor, startsAt: new Date(input.salesStart), endsAt: new Date(input.earlyBirdEndsAt) },
                { label: "Regular", priceMinor: input.priceMinor, startsAt: new Date(input.earlyBirdEndsAt), endsAt: new Date(input.salesEnd) },
              ],
            } : undefined,
          },
        },
      },
    });
    await writeAudit(actor, { action: "EVENT_CREATED", entityType: "Event", entityId: event.id, summary: `Создано мероприятие ${event.title}` });
    return NextResponse.json({ id: event.id }, { status: 201 });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    const message = error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join(". ")
      : error instanceof Error
        ? error.message
        : "Ошибка";
    return NextResponse.json(
      { error: forbidden ? "Недостаточно прав" : message },
      { status: forbidden ? 403 : 400 },
    );
  }
}
