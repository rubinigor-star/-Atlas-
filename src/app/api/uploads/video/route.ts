import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 50_000_000;

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json() as HandleUploadBody;

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        await requirePermission("TICKET_MANAGE");
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          throw new Error("VIDEO_STORAGE_NOT_CONFIGURED");
        }

        return {
          allowedContentTypes: ["video/mp4", "video/webm"],
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 86_400,
        };
      },
      onUploadCompleted: async () => {
        // The event is updated only when the organizer saves the form.
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIDEO_UPLOAD_ERROR";
    const publicMessage = message === "FORBIDDEN"
      ? "Недостаточно прав"
      : message === "VIDEO_STORAGE_NOT_CONFIGURED"
        ? "Хранилище видео ещё не подключено в Vercel"
        : message;

    return NextResponse.json({ error: publicMessage }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
