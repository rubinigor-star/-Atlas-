import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { catalogVisibilityValues, eventLanguageValues } from "@/lib/event-language";
import { locales, resolveStaffLocale, type Locale } from "@/lib/i18n";
import { getEventLanguageSettings, saveEventLanguageSettings } from "@/lib/event-language-server";

const schema = z.object({primaryLanguage:z.enum(eventLanguageValues),catalogVisibility:z.enum(catalogVisibilityValues),customerCommunicationLocale:z.enum(locales as ["ru","he","en"])});
const copy={ru:{forbidden:"Недостаточно прав",validation:"Проверьте настройки языка мероприятия",failed:"Не удалось сохранить настройки языка"},he:{forbidden:"אין הרשאה מתאימה",validation:"בדקו את הגדרות שפת האירוע",failed:"לא ניתן לשמור את הגדרות השפה"},en:{forbidden:"Insufficient permission",validation:"Check the event language settings",failed:"Could not save the language settings"}} as const;
function localeFor(actor:Awaited<ReturnType<typeof requireEventAccess>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let locale:Locale="ru";
  try {
    const { id } = await params;
    const input = schema.parse(await req.json());
    const actor = await requireEventAccess("EVENT_MANAGE", id);locale=localeFor(actor);
    const event = await db.event.findUniqueOrThrow({ where: { id }, select: { title: true } });
    const before = await getEventLanguageSettings(id);
    await saveEventLanguageSettings(id, input, actor.id);
    await writeAudit(actor,{action:"EVENT_LANGUAGE_UPDATED",entityType:"Event",entityId:id,summary:"EVENT_LANGUAGE_UPDATED",metadata:{title:event.title,before,after:input}});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin.event.language_update_failed",{message:error instanceof Error?error.message:"UNKNOWN_LANGUAGE_ERROR"});
    const forbidden=error instanceof Error&&error.message==="FORBIDDEN";const text=copy[locale];
    return NextResponse.json({error:forbidden?text.forbidden:error instanceof z.ZodError?text.validation:text.failed},{status:forbidden?403:400});
  }
}
