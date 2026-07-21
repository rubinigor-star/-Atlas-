import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createEventSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const input = createEventSchema.parse(body);
    const org = await db.organization.findFirst();
    if (!org) throw new Error("Организация не настроена");
    const posterUrl =
      typeof body === "object" && body && "posterUrl" in body && typeof body.posterUrl === "string"
        ? body.posterUrl
        : "/assets/noa-live-tel-aviv.png";
    const event = await db.event.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        posterUrl,
        startsAt: new Date(input.startsAt),
        salesStart: new Date(),
        salesEnd: new Date(input.startsAt),
        status: "PUBLISHED",
        organization: { connect: { id: org.id } },
        venue: {
          create: {
            name: input.venueName,
            city: input.city,
            address: input.city,
          },
        },
        categories: {
          create: {
            name: input.categoryName,
            priceMinor: input.priceMinor,
            capacity: input.capacity,
          },
        },
      },
    });
    return NextResponse.json({ id: event.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 400 },
    );
  }
}
