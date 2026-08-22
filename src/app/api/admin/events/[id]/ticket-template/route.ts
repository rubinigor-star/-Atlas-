import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ticketTemplateSchema } from "@/lib/ticket-template";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";

const copy={ru:{forbidden:"Недостаточно прав",validation:"Проверьте настройки дизайна билета",failed:"Не удалось сохранить дизайн билета"},he:{forbidden:"אין הרשאה מתאימה",validation:"בדקו את הגדרות עיצוב הכרטיס",failed:"לא ניתן לשמור את עיצוב הכרטיס"},en:{forbidden:"Insufficient permission",validation:"Check the ticket design settings",failed:"Could not save the ticket design"}} as const;
function localeFor(actor:Awaited<ReturnType<typeof requireEventAccess>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 let locale:Locale="ru";
 try{
  const{id}=await params;const actor=await requireEventAccess("TICKET_MANAGE",id);locale=localeFor(actor);const design=ticketTemplateSchema.parse(await request.json());
  const template=await db.ticketTemplate.upsert({where:{eventId:id},create:{eventId:id,name:design.name,backgroundColor:design.backgroundColor,accentColor:design.accentColor,textColor:design.textColor,logoUrl:design.logoUrl,backgroundUrl:design.backgroundUrl,canvasJson:JSON.stringify(design.elements)},update:{name:design.name,backgroundColor:design.backgroundColor,accentColor:design.accentColor,textColor:design.textColor,logoUrl:design.logoUrl,backgroundUrl:design.backgroundUrl,canvasJson:JSON.stringify(design.elements)}});
  const tickets=await db.ticket.findMany({where:{order:{eventId:id}},select:{id:true}});await db.ticket.updateMany({where:{id:{in:tickets.map(ticket=>ticket.id)}},data:{walletUpdatedAt:new Date()}});const pushed=await notifyWalletTickets(tickets.map(ticket=>ticket.id));
  await writeAudit(actor,{action:"TICKET_TEMPLATE_UPDATED",entityType:"TicketTemplate",entityId:template.id,summary:"TICKET_TEMPLATE_UPDATED",metadata:{elements:design.elements.length}});
  return NextResponse.json({ok:true,updatedWalletPasses:tickets.length,pushed});
 }catch(error){console.error("admin.ticket_template.update_failed",{message:error instanceof Error?error.message:"UNKNOWN_TEMPLATE_ERROR"});const forbidden=error instanceof Error&&error.message==="FORBIDDEN";const text=copy[locale];return NextResponse.json({error:forbidden?text.forbidden:error instanceof z.ZodError?text.validation:text.failed},{status:forbidden?403:400});}
}
