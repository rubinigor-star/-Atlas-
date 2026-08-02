import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export async function POST() {
  try {
    await requirePermission("ORDER_MANAGE");

    return NextResponse.json(
      {
        error:
          "Возвраты через HYP временно отключены до завершения и проверки нового API-потока. Деньги не были списаны и статус заказа не изменён.",
      },
      { status: 503 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка авторизации";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
