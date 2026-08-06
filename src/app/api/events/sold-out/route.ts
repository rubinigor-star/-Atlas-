import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      description: { contains: "<!--ATLAS_SOLD_OUT:true-->" },
    },
    select: { slug: true },
  });

  return NextResponse.json(
    { slugs: events.map((event) => event.slug) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
