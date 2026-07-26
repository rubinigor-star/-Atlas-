import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { EventManager } from "@/components/event-manager";
import { EventAiAssistant } from "@/components/event-ai-assistant";
import { VenueMapEditor } from "@/components/venue-map-editor";
import { FullscreenVenueEditor } from "@/components/fullscreen-venue-editor";
import { GuestLinkManager } from "@/components/guest-link-manager";
import { PricingStrategyManager } from "@/components/pricing-strategy-manager";
import { CategoryManager } from "@/components/category-manager";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { describeCategoryPrice } from "@/lib/ticketing";
import { requireEventAccess } from "@/lib/auth";
import { parseEventMedia, stripEventMedia } from "@/lib/event-media";
import { parseEventRejectionMessage, stripEventRejectionMessage } from "@/lib/event-approval-message";
import { guestManagementToken } from "@/lib/guest-links";
import { parsePricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function ManageEvent({params}:{params:Promise<{id:string}>}){
 const{id}=await params;const staff=await requireEventAccess("EVENT_VIEW",id);
 const event=await db.event.findUnique({where:{id},include:{venue:true,categories:{include:{priceTiers:true}},promoterLinks:{orderBy:{createdAt:"desc"},include:{promoter:true,category:true,table:true}},zones:{include:{tables:{include:{seatItems:true}}}}}});if(!event)notFound();
 const now=new Date();
 const managedCategories=event.categories.map((category)=>{const status=describeCategoryPrice(category,now);return{id:category.id,name:category.name,description:category.description,priceMinor:category.priceMinor,pricingMode:category.pricingMode,capacity:category.capacity,sold:category.sold,hidden:category.hidden,colorHex:category.colorHex,maxPerOrder:category.maxPerOrder,salesStart:category.salesStart?category.salesStart.toISOString():null,salesEnd:category.salesEnd?category.salesEnd.toISOString():null,priceTiers:category.priceTiers.map((tier)=>({id:tier.id,label:tier.label,priceMinor:tier.priceMinor,startsAt:tier.startsAt.toISOString(),endsAt:tier.endsAt.toISOString()})),currentPriceMinor:status.currentPriceMinor,statusLabel:status.statusLabel,nextTierPriceMinor:status.nextTier?.priceMinor,nextTierStartsAt:status.nextTier?.startsAt.toISOString()};});
 const tables=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,seats:item.seats,categoryId:item.categoryId})));
 const media=parseEventMedia(event.description);const cleanDescription=stripEventRejectionMessage(stripEventMedia(event.description));const rejectionMessage=parseEventRejectionMessage(event.description);
 return <AdminShell><span className="eyebrow">Event manager</span><h1>{event.title}</h1><div className="stats"><div className="stat"><span className="muted">Статус</span><strong>{event.status}</strong></div><div className="stat"><span className="muted">Продажа</span><strong>{event.salesMode==="INSTANT"?"Автоматически":"По одобрению"}</strong></div><div className="stat"><span className="muted">VIP-столов</span><strong>{event.zones.reduce((sum,zone)=>sum+zone.tables.length,0)}</strong></div></div>
 {(staff.permissionSet.has("EVENT_MANAGE")||staff.permissionSet.has("TICKET_MANAGE"))&&<EventAiAssistant event={{id:event.id,title:event.title,status:event.status,salesMode:event.salesMode,startsAt:event.startsAt.toISOString(),venue:`${event.venue.name}, ${event.venue.city}`,categories:event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor,capacity:item.capacity,sold:item.sold,pricingMode:item.pricingMode}))}}/>}
 {staff.permissionSet.has("TICKET_MANAGE")?<CategoryManager eventId={event.id} categories={managedCategories}/>:<div className="table-wrap"><table><thead><tr><th>Категория</th><th>Цена сейчас</th><th>Продано</th><th>Остаток</th></tr></thead><tbody>{managedCategories.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.currentPriceMinor!==null?money(item.currentPriceMinor):item.statusLabel}</td><td>{item.sold}</td><td>{item.capacity-item.sold}</td></tr>)}</tbody></table></div>}
 {(staff.permissionSet.has("EVENT_MANAGE")||staff.permissionSet.has("TICKET_MANAGE"))&&<div className="row between"><h2>Настройки</h2>{staff.permissionSet.has("TICKET_MANAGE")&&<Link className="btn dark" href={`/office/events/${event.id}/ticket-design`}>Открыть редактор билета</Link>}</div>}
 {staff.permissionSet.has("EVENT_MANAGE")&&<EventManager event={{id:event.id,title:event.title,description:cleanDescription,posterUrl:event.posterUrl,media,rejectionMessage,status:event.status,startsAt:event.startsAt.toISOString(),salesMode:event.salesMode,approvalInstructions:event.approvalInstructions,mapEnabled:event.mapEnabled,venueName:event.venue.name,city:event.venue.city,address:event.venue.address}}/>}
 {staff.permissionSet.has("TICKET_MANAGE")&&<PricingStrategyManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,pricingMode:item.pricingMode,strategy:parsePricingMarketingStrategy(item.description)}))}/>} 
 {staff.permissionSet.has("EVENT_MANAGE")&&<GuestLinkManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor}))} tables={tables} existingLinks={event.promoterLinks.map(item=>{const guest=item.promoter.name.startsWith("__GUEST_LIST__")||item.promoter.name.startsWith("__CHANNEL__:GUEST:");const allocation=item.table?`Стол ${item.table.label}`:item.category?`Категория ${item.category.name}`:"Все билеты";const priceLabel=item.customPriceMinor===0?"0 ₪":item.customPriceMinor!=null?money(item.customPriceMinor):"обычная цена";return{id:item.id,label:item.label,code:item.code,kind:guest?"GUEST" as const:"SALES" as const,allocation,priceLabel,limit:item.guestLimit,publicPath:guest?`/g/${item.code}`:`/events/${event.slug}?channel=${item.code}`,managePath:guest?`/g/${item.code}?token=${guestManagementToken(item.id)}`:null}})}/>} 
 {event.mapEnabled&&staff.permissionSet.has("TICKET_MANAGE")&&<FullscreenVenueEditor><VenueMapEditor eventId={event.id} categories={event.categories.map(category=>({id:category.id,name:category.name,priceMinor:category.priceMinor,colorHex:category.colorHex}))} initialObjects={event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:item.label,objectType:item.objectType,seats:item.seats,priceMode:item.priceMode,priceMinor:item.priceMinor,x:item.x,y:item.y,rotation:item.rotation,width:item.width,height:item.height,categoryId:item.categoryId,reserved:item.reserved||item.seatItems.some(seat=>seat.status!=="AVAILABLE"),seatAssignments:item.seatItems.map(seat=>({position:seat.position,categoryId:seat.categoryId}))})))}/></FullscreenVenueEditor>}
 </AdminShell>;
}