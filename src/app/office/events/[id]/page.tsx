import AdminEventPage from "@/app/admin/events/[id]/page";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { assignAutoPromotersToEvent, notifyEventPromoters } from "@/lib/promoter-workflow";

export const dynamic="force-dynamic";

export default async function OfficeEventPage(props:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|undefined>>}){
 const {id}=await props.params;
 await requireEventAccess("EVENT_VIEW",id);
 const event=await db.event.findUnique({where:{id},select:{status:true}});
 if(event?.status==="PUBLISHED"){
  try{await assignAutoPromotersToEvent(id);await notifyEventPromoters(id,false)}catch(error){console.error("[promoter-publish-workflow]",error)}
 }
 return AdminEventPage(props as never);
}
