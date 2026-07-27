import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOfficeSession } from "@/lib/auth";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user?.active || !user.organizationId) {
      throw new Error("Сотрудник недоступен");
    }

    await createOfficeSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 400 },
    );
  }
}
