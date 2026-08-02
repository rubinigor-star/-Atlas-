import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessEvent, type CurrentStaff } from "@/lib/auth";

type Executor = Prisma.TransactionClient;

export type CheckinStatus = "VALID" | "USED" | "CANCELLED" | "NOT_FOUND" | "WRONG_EVENT" | "TOO_EARLY";

export type CheckinResult = {
  status: CheckinStatus;
  message: string;
  ticketId?: string;
  eventId?: string;
  eventTitle?: string;
  holderName?: string;
  categoryName?: string;
  orderPublicId?: string;
  warning?: string;
};

export function normalizeTicketCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("code") || url.searchParams.get("ticket");
    if (fromQuery) return fromQuery.trim();
    const last = url.pathname.split("/").filter(Boolean).at(-1);
    return (last || trimmed).trim();
  } catch {
    return trimmed;
  }
}

export async function checkInTicket({
  code,
  staff,
  selectedEventId,
}: {
  code: string;
  staff: CurrentStaff;
  selectedEventId?: string | null;
}): Promise<CheckinResult> {
  const publicCode = normalizeTicketCode(code);
  if (!publicCode) return { status: "NOT_FOUND", message: "Код билета пуст" };

  return db.$transaction<CheckinResult>(async (tx: Executor) => {
    const ticket = await tx.ticket.findUnique({
      where: { publicCode },
      include: {
        category: true,
        order: { include: { event: true } },
      },
    });

    const visible = ticket
      && ticket.order.event.organizationId === staff.organizationId
      && canAccessEvent(staff, ticket.order.eventId)
      ? ticket
      : null;

    if (!visible) {
      await tx.scan.create({ data: { result: "NOT_FOUND" } });
      return { status: "NOT_FOUND", message: "Билет с таким кодом не найден" };
    }

    const details = {
      ticketId: visible.id,
      eventId: visible.order.eventId,
      eventTitle: visible.order.event.title,
      holderName: visible.holderName,
      categoryName: visible.category.name,
      orderPublicId: visible.order.publicId,
    };

    if (selectedEventId && selectedEventId !== visible.order.eventId) {
      await tx.scan.create({ data: { result: "WRONG_EVENT", ticketId: visible.id } });
      return { status: "WRONG_EVENT", message: "Билет относится к другому мероприятию", ...details };
    }

    if (visible.order.status !== "PAID" || visible.status === "CANCELLED") {
      await tx.scan.create({ data: { result: "CANCELLED", ticketId: visible.id } });
      return { status: "CANCELLED", message: "Билет отменён или заказ не оплачен", ...details };
    }

    if (visible.status === "USED") {
      await tx.scan.create({ data: { result: "USED", ticketId: visible.id } });
      return { status: "USED", message: "Этот билет уже был использован", ...details };
    }

    const now = Date.now();
    const start = visible.order.event.startsAt.getTime();
    const earlyWindowMs = 12 * 60 * 60 * 1000;
    const lateWindowMs = 24 * 60 * 60 * 1000;
    if (now < start - earlyWindowMs) {
      await tx.scan.create({ data: { result: "TOO_EARLY", ticketId: visible.id } });
      return { status: "TOO_EARLY", message: "Для этого мероприятия вход ещё не открыт", ...details };
    }
    const warning = now > start + lateWindowMs ? "Мероприятие уже завершилось. Проверьте билет вручную." : undefined;

    const claimed = await tx.ticket.updateMany({
      where: { id: visible.id, status: "VALID", order: { status: "PAID" } },
      data: { status: "USED", walletUpdatedAt: new Date() },
    });

    if (claimed.count !== 1) {
      await tx.scan.create({ data: { result: "USED", ticketId: visible.id } });
      return { status: "USED", message: "Билет уже использован другим устройством", ...details };
    }

    await tx.scan.create({ data: { result: "VALID", ticketId: visible.id } });
    return { status: "VALID", message: "Вход разрешён", warning, ...details };
  });
}
