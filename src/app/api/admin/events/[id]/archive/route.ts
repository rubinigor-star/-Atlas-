import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";
import {archiveDeleteSql,archiveInsertSql,ensureEventArchiveRuntime,isEventArchived} from "@/lib/event-archive";

const bodySchema = z.object({ action: z.enum(["archive", "restore"]) });
const copy={ru:{missing:"Мероприятие не найдено",restore:"Восстановить можно только архивированное мероприятие",forbidden:"Недостаточно прав",failed:"Не удалось изменить состояние архива"},he:{missing:"האירוע לא נמצא",restore:"ניתן לשחזר רק אירוע שנמצא בארכיון",forbidden:"אין הרשאה מתאימה",failed:"לא ניתן לעדכן את מצב הארכיון"},en:{missing:"Event not found",restore:"Only an archived event can be restored",forbidden:"Insufficient permission",failed:"Could not update the archive state"}} as const;
function localeFor(actor:Awaited<ReturnType<typeof requireEventAccess>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}
function localize(error:unknown,locale:Locale){const raw=error instanceof Error?error.message:"";const c=copy[locale];if(raw==="FORBIDDEN")return c.forbidden;if(raw==="Мероприятие не найдено")return c.missing;if(raw.includes("Восстановить можно только"))return c.restore;return c.failed;}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let locale:Locale="ru";
  try {
    const { id } = await params;
    const actor = await requireEventAccess("EVENT_MANAGE", id);locale=localeFor(actor);
    const input = bodySchema.parse(await req.json());
    const event = await db.event.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
    if (!event) throw new Error("Мероприятие не найдено");
    await ensureEventArchiveRuntime();
    if (input.action === "archive") {
      if (await isEventArchived(id)) return NextResponse.json({ ok: true, archived: true });
      await db.$transaction(async (tx) => {await tx.event.update({ where: { id }, data: { status: "DRAFT" } });await tx.$executeRawUnsafe(archiveInsertSql(),id,new Date().toISOString(),actor.id,String(event.status));});
      await writeAudit(actor,{action:"EVENT_ARCHIVE",entityType:"Event",entityId:id,summary:"EVENT_ARCHIVE",metadata:{title:event.title}});
      return NextResponse.json({ ok: true, archived: true });
    }
    if (!(await isEventArchived(id))) throw new Error("Восстановить можно только архивированное мероприятие");
    await db.$executeRawUnsafe(archiveDeleteSql(), id);
    await writeAudit(actor,{action:"EVENT_RESTORE_FROM_ARCHIVE",entityType:"Event",entityId:id,summary:"EVENT_RESTORE_FROM_ARCHIVE",metadata:{title:event.title}});
    return NextResponse.json({ ok: true, archived: false, status: "DRAFT" });
  } catch (error) {
    console.error("admin.event.archive_failed",{message:error instanceof Error?error.message:"UNKNOWN_ARCHIVE_ERROR"});
    const forbidden=error instanceof Error&&error.message==="FORBIDDEN";
    return NextResponse.json({ error: localize(error,locale) },{ status: forbidden?403:400 });
  }
}
