import { NextResponse } from "next/server";
import { z } from "zod";
import { activatePromoterAccount, createPromoterSession, loginPromoter, logoutPromoter, requestPromoterPasswordReset, resetPromoterPassword } from "@/lib/promoter-auth";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate"), token: z.string().min(20), password: z.string().min(8).max(200) }),
  z.object({ action: z.literal("login"), email: z.string().email(), password: z.string().min(1).max(200) }),
  z.object({ action: z.literal("forgot"), email: z.string().email() }),
  z.object({ action: z.literal("reset"), token: z.string().min(20), password: z.string().min(8).max(200) }),
  z.object({ action: z.literal("logout") }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (input.action === "activate") {
      const promoterId = await activatePromoterAccount(input.token, input.password);
      await createPromoterSession(promoterId);
      return NextResponse.json({ ok: true, redirect: "/promoter" });
    }
    if (input.action === "login") {
      await loginPromoter(input.email, input.password);
      return NextResponse.json({ ok: true, redirect: "/promoter" });
    }
    if (input.action === "forgot") {
      await requestPromoterPasswordReset(input.email);
      return NextResponse.json({ ok: true, message: "Если аккаунт существует, письмо отправлено." });
    }
    if (input.action === "reset") {
      const promoterId = await resetPromoterPassword(input.token, input.password);
      await createPromoterSession(promoterId);
      return NextResponse.json({ ok: true, redirect: "/promoter" });
    }
    await logoutPromoter();
    return NextResponse.json({ ok: true, redirect: "/promoter/login" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка авторизации";
    console.error("[promoter-auth]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
