import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { description: { contains: "<!--ATLAS_SOLD_OUT:true-->" } },
        { description: { contains: "<!--ATLAS_LAST_TICKETS:true-->" } },
      ],
    },
    select: { slug: true, description: true },
  });

  return NextResponse.json(
    {
      soldOutSlugs: events.filter((event) => event.description.includes("<!--ATLAS_SOLD_OUT:true-->")).map((event) => event.slug),
      lastTicketsSlugs: events.filter((event) => event.description.includes("<!--ATLAS_LAST_TICKETS:true-->")).map((event) => event.slug),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
