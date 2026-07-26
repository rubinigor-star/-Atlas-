import { db } from "@/lib/db";
import { generateTicketPdf } from "@/lib/ticket-pdf";
import { parseTicketDesign } from "@/lib/ticket-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      category: true,
      order: { include: { event: { include: { venue: true, ticketTemplate: true } } } },
    },
  });
  if (!ticket) return new Response("Ticket not found", { status: 404 });

  const event = ticket.order.event;
  const bytes = await generateTicketPdf([
    {
      eventTitle: event.title,
      startsAt: event.startsAt,
      venueName: event.venue.name,
      venueAddress: event.venue.address,
      holderName: ticket.holderName,
      categoryName: ticket.category.name,
      orderNumber: ticket.order.publicId,
      ticketCode: ticket.publicCode,
      status: ticket.status,
      design: parseTicketDesign(event.ticketTemplate),
    },
  ]);

  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="atlas-one-${ticket.id}.pdf"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
