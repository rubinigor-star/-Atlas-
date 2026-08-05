import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

const GALLERY_MAX_BYTES = 1_000_000;
const POSTER_MAX_BYTES = 2_000_000;

export async function POST(req: Request) {
  try {
    await requirePermission("TICKET_MANAGE");
    const data = await req.formData();
    const galleryFile = data.get("image");
    const posterFile = data.get("poster");
    const file = galleryFile ?? posterFile;
    const isGallery = galleryFile instanceof File;
    const maxBytes = isGallery ? GALLERY_MAX_BYTES : POSTER_MAX_BYTES;

    if (!(file instanceof File) || !file.type.match(/^image\/(jpeg|png|webp)$/)) {
      throw new Error("Нужен файл JPG, PNG или WebP");
    }
    if (file.size > maxBytes) {
      throw new Error(isGallery
        ? "Фотография галереи должна весить не больше 1 МБ"
        : "Главная афиша должна весить не больше 2 МБ");
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
