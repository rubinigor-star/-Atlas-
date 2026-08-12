import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> },
) {
  try {
    const { id, categoryId } = await params;
    await requireEventAccess("TICKET_MANAGE", id);

    const category = await db.ticketCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            tickets: true,
            seatingObjects: true,
            assignedSeats: true,
            promoterLinks: true,
          },
        },
      },
    });

    if (!category || category.eventId !== id) {
      return NextResponse.json({ error: "Категория билета не найдена" }, { status: 404 });
    }

    const orderItems = await db.orderItem.count({
      where: {
        categoryName: category.name,
        order: { eventId: id },
      },
    });

    if (category.sold > 0 || category._count.tickets > 0 || orderItems > 0) {
      return NextResponse.json(
        {
          error:
            "Этот билет уже использовался в заказах. Удалять его нельзя, чтобы сохранить историю продаж. Спрячьте его с продажи.",
        },
        { status: 409 },
      );
    }

    if (
      category._count.seatingObjects > 0 ||
      category._count.assignedSeats > 0 ||
      category._count.promoterLinks > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Этот билет используется на карте мест или в промоутерской ссылке. Сначала отвяжите его либо спрячьте с продажи.",
        },
        { status: 409 },
      );
    }

    await db.$transaction(async (tx) => {
      await tx.ticketPriceTier.deleteMany({ where: { categoryId } });
      await tx.ticketCategory.delete({ where: { id: categoryId } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ticket_category.delete_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить билет" },
      { status: 400 },
    );
  }
}
