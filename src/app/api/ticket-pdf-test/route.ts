import { generateTicketPdf } from "@/lib/ticket-pdf";
import { classicTicketPresets } from "@/lib/ticket-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("template");
  const presets = requested ? classicTicketPresets.filter(item => item.id === requested || item.design.name === requested) : classicTicketPresets;
  if (!presets.length) return new Response("Unknown template", { status: 404 });
  const startsAt = new Date("2026-09-18T20:30:00+03:00");
  const bytes = await generateTicketPdf(presets.map((preset, index) => ({
    eventTitle: `Atlas One — ${preset.label}`,
    startsAt,
    venueName: "Malina Club",
    venueCity: "Хайфа",
    venueAddress: "חלוצי התעשייה 73",
    holderName: index % 2 ? "איגור רובין" : "Игорь Рубин",
    categoryName: index % 2 ? "כניסה רגילה" : "VIP — Стол 12",
    orderNumber: `TEST-${index + 1}-2026`,
    ticketCode: `ATLAS-CLASSIC-${index + 1}-PDF-SMOKE-TEST`,
    ticketStatus: "VALID",
    design: preset.design,
  })));
  return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="atlas-one-classic-test.pdf"`, "cache-control": "no-store, max-age=0", "x-atlas-pdf-test": "classic-presets-v1" } });
}
