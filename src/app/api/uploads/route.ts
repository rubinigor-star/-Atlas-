import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requirePermission("TICKET_MANAGE");
    const data = await req.formData();
    const file = data.get("image") ?? data.get("poster");
    if (!(file instanceof File) || !file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 2_000_000) {
      throw new Error("Нужен JPG, PNG или WebP до 2 MB");
    }

    // Vercel Functions have a read-only application filesystem. Keep the image
    // in a portable data URL until external object storage is connected.
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = `data:${file.type};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload error";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Недостаточно прав" : message },
      { status: message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
