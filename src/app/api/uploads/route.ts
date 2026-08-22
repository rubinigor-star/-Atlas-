import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

const GALLERY_MAX_BYTES = 1_000_000;
const POSTER_MAX_BYTES = 2_000_000;
const copy={ru:{type:"Нужен файл JPG, PNG или WebP",gallery:"Фотография галереи должна весить не больше 1 МБ",poster:"Главная афиша должна весить не больше 2 МБ",forbidden:"Недостаточно прав",failed:"Не удалось загрузить изображение"},he:{type:"יש לבחור קובץ JPG, PNG או WebP",gallery:"גודל תמונה בגלריה חייב להיות עד 1MB",poster:"גודל הכרזה הראשית חייב להיות עד 2MB",forbidden:"אין הרשאה מתאימה",failed:"לא ניתן להעלות את התמונה"},en:{type:"Choose a JPG, PNG or WebP file",gallery:"Gallery images must be no larger than 1 MB",poster:"The main poster must be no larger than 2 MB",forbidden:"Insufficient permission",failed:"Could not upload the image"}} as const;
function localeFor(actor:Awaited<ReturnType<typeof requirePermission>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}

export async function POST(req: Request) {
  let locale:Locale="ru";
  try {
    const actor=await requirePermission("TICKET_MANAGE");locale=localeFor(actor);const text=copy[locale];
    const data = await req.formData();
    const galleryFile = data.get("image");
    const posterFile = data.get("poster");
    const file = galleryFile ?? posterFile;
    const isGallery = galleryFile instanceof File;
    const maxBytes = isGallery ? GALLERY_MAX_BYTES : POSTER_MAX_BYTES;
    if (!(file instanceof File) || !file.type.match(/^image\/(jpeg|png|webp)$/)) return NextResponse.json({error:text.type},{status:400});
    if (file.size > maxBytes) return NextResponse.json({error:isGallery?text.gallery:text.poster},{status:400});
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = `data:${file.type};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error("office.image_upload_failed",{message:error instanceof Error?error.message:"UNKNOWN_UPLOAD_ERROR"});
    const forbidden=error instanceof Error&&error.message==="FORBIDDEN";
    return NextResponse.json({ error: forbidden?copy[locale].forbidden:copy[locale].failed },{ status: forbidden?403:400 });
  }
}
