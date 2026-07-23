import { NextResponse } from "next/server";
import { z } from "zod";
import { validateAndUseTicket } from "@/lib/ticket-engine";

const schema = z.object({ code: z.string().min(10).max(200) });

export async function POST(req: Request) {
  try {
    const { code } = schema.parse(await req.json());
    const result = await validateAndUseTicket(code.trim());
    const status = result.result === "NOT_FOUND" ? 404 : result.result === "VALID" ? 200 : 409;
    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Некорректный QR-код" },
      { status: 400 },
    );
  }
}
