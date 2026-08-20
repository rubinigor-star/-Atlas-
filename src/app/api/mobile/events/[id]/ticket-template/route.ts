import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { parseTicketDesign, ticketTemplateSchema } from "@/lib/ticket-template";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { writeAudit } from "@/lib/audit";

async function authorize(request: Request, eventId: string) {
  const actor = await getMobileStaff(request);
  if (!actor) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  if (!actor.permissionSet.has("TICKET_MANAGE")) return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, organizationId: true } });
  if (!event) return { error: NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 }) } as const;
  const organizationAccess = actor.role === "ADMIN" || Boolean(actor.organizationId && actor.organizationId === event.organizationId);
  const scoped = actor.eventAccess.length > 0;
  const eventAccess = actor.eventAccess.some((access) => access.eventId === eventId);
  if (!organizationAccess || (scoped && !eventAccess)) return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  return { actor } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if ("error" in auth) return auth.error;
  const event = await db.event.findUnique({ where: { id }, include: { venue: true, ticketTemplate: true, categories: { select: { name: true } } } });
  if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  return NextResponse.json({
    event: { id: event.id, title: event.title, startsAt: event.startsAt.toISOString(), venue: event.venue.name, address: event.venue.address, ticketType: event.categories[0]?.name ?? "General Admission" },
    design: parseTicketDesign(event.ticketTemplate),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await authorize(request, id);
    if ("error" in auth) return auth.error;
    const design = ticketTemplateSchema.parse(await request.json());
    const template = await db.ticketTemplate.upsert({
      where: { eventId: id },
      create: { eventId: id, name: design.name, backgroundColor: design.backgroundColor, accentColor: design.accentColor, textColor: design.textColor, logoUrl: design.logoUrl, backgroundUrl: design.backgroundUrl, canvasJson: JSON.stringify(design.elements) },
      update: { name: design.name, backgroundColor: design.backgroundColor, accentColor: design.accentColor, textColor: design.textColor, logoUrl: design.logoUrl, backgroundUrl: design.backgroundUrl, canvasJson: JSON.stringify(design.elements) },
    });
    const tickets = await db.ticket.findMany({ where: { order: { eventId: id } }, select: { id: true } });
    await db.ticket.updateMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } }, data: { walletUpdatedAt: new Date() } });
    const pushed = await notifyWalletTickets(tickets.map((ticket) => ticket.id));
    await writeAudit(auth.actor, { action: "TICKET_TEMPLATE_UPDATED", entityType: "TicketTemplate", entityId: template.id, summary: "Обновлён дизайн билета из мобильного приложения", metadata: { elements: design.elements.length } });
    return NextResponse.json({ ok: true, updatedWalletPasses: tickets.length, pushed, design });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 400 });
  }
}
