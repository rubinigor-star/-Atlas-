import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parseEventMedia, withEventMedia, type EventMediaItem } from "@/lib/event-media";

const imageUrl = z.string().max(360_000).refine(
  (value) => /^https?:\/\//i.test(value) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(value),
  "Некорректная ссылка на изображение",
);

const schema = z.object({
  shortDescription: z.string().max(250).default(""),
  galleryEnabled: z.boolean().default(false),
  galleryUrls: z.array(imageUrl).max(6).default([]),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireEventAccess("EVENT_VIEW", id);
    const event = await db.event.findUniqueOrThrow({ where: { id }, select: { description: true } });
    const media = parseEventMedia(event.description);
    return NextResponse.json({
      shortDescription: media.find((item) => item.type === "SUMMARY")?.text ?? "",
      galleryEnabled: media.some((item) => item.type === "IMAGE"),
      galleryUrls: media.filter((item): item is Extract<EventMediaItem, { type: "IMAGE" }> => item.type === "IMAGE").map((item) => item.url),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireEventAccess("EVENT_MANAGE", id);
    const value = schema.parse(await request.json());
    const event = await db.event.findUniqueOrThrow({ where: { id }, select: { description: true } });
    const current = parseEventMedia(event.description).filter((item) => item.type !== "SUMMARY" && item.type !== "IMAGE");
    const media: EventMediaItem[] = [
      ...current,
      ...(value.shortDescription.trim() ? [{ type: "SUMMARY" as const, text: value.shortDescription.trim() }] : []),
      ...(value.galleryEnabled ? value.galleryUrls.map((url) => ({ type: "IMAGE" as const, url })) : []),
    ];
    await db.event.update({ where: { id }, data: { description: withEventMedia(event.description, media) } });
    await writeAudit(actor, { action: "EVENT_PRESENTATION_UPDATE", entityType: "Event", entityId: id, summary: "Обновлены краткое описание и галерея мероприятия" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}