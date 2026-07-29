import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateOfficeUser } from "@/lib/auth";
import { createMobileSessionToken } from "@/lib/mobile-auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const result = await authenticateOfficeUser(parsed.data.email, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  const token = createMobileSessionToken(result.user.id);
  return NextResponse.json(
    {
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        staffRole: result.user.staffRole,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
