import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 50_000_000;
const copy={ru:{forbidden:"Недостаточно прав",storage:"Хранилище видео ещё не подключено в Vercel",failed:"Не удалось загрузить видео"},he:{forbidden:"אין הרשאה מתאימה",storage:"אחסון הווידאו עדיין לא מחובר ב-Vercel",failed:"לא ניתן להעלות את הווידאו"},en:{forbidden:"Insufficient permission",storage:"Video storage is not configured in Vercel yet",failed:"Could not upload video"}} as const;
function localeFor(actor:Awaited<ReturnType<typeof requirePermission>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}

export async function POST(request: Request): Promise<NextResponse> {
  let locale:Locale="ru";
  try {
    const actor=await requirePermission("TICKET_MANAGE");locale=localeFor(actor);
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("VIDEO_STORAGE_NOT_CONFIGURED");
        return {allowedContentTypes: ["video/mp4", "video/webm"],maximumSizeInBytes: MAX_VIDEO_BYTES,addRandomSuffix: true,cacheControlMaxAge: 86_400};
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIDEO_UPLOAD_ERROR";
    console.error("office.video_upload_failed",{message});
    const text=copy[locale];
    const publicMessage = message === "FORBIDDEN" ? text.forbidden : message === "VIDEO_STORAGE_NOT_CONFIGURED" ? text.storage : text.failed;
    return NextResponse.json({ error: publicMessage }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
