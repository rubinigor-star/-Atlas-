import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { parseTicketDesign } from "@/lib/ticket-template";
import { AdminShell } from "@/components/admin-shell";
import { TicketDesigner } from "@/components/ticket-designer";

export const dynamic="force-dynamic";
export default async function TicketDesignPage({params}:{params:Promise<{id:string}>}){const{id}=await params;await requireEventAccess("TICKET_MANAGE",id);const event=await db.event.findUnique({where:{id},include:{venue:true,ticketTemplate:true,categories:{select:{name:true}}}});if(!event)notFound();return <AdminShell><TicketDesigner event={{id:event.id,title:event.title,startsAt:event.startsAt.toISOString(),venue:event.venue.name,address:event.venue.address,ticketType:event.categories[0]?.name??"General Admission"}} initialDesign={parseTicketDesign(event.ticketTemplate)}/></AdminShell>}
