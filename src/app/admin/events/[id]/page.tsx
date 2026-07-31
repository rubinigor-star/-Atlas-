import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { EventManager } from "@/components/event-manager";
import { EventArchiveControl } from "@/components/event-archive-control";
import { EventTypeManager } from "@/components/event-type-manager";
import { EventLanguageManager } from "@/components/event-language-manager";
import { EventAtlasAssistant } from "@/components/event-atlas-assistant";
import { VenueMapEditor } from "@/components/venue-map-editor";
import { FullscreenVenueEditor } from "@/components/fullscreen-venue-editor";
import { GuestLinkManager } from "@/components/guest-link-manager";
import { PricingStrategyManager } from "@/components/pricing-strategy-manager";
import { CategoryManager } from "@/components/category-manager";
import { CheckoutFormManager } from "@/components/checkout-form-manager";
import { EventCommercialTermsForm } from "@/components/event-commercial-terms-form";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { describeCategoryPrice } from "@/lib/ticketing";
import { ensureDemoOrganizerAccount, requireEventAccess } from "@/lib/auth";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { parseEventMedia, stripEventMedia } from "@/lib/event-media";
import { parseEventRejectionMessage, stripEventRejectionMessage } from "@/lib/event-approval-message";
import { parseBuyerQuestions, stripBuyerQuestions } from "@/lib/buyer-questions";
import { parseGuestFields, stripEventMarkers } from "@/lib/event-guest-fields";
import { guestManagementToken } from "@/lib/guest-links";
import { parsePricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { parseEventType, stripEventType } from "@/lib/event-type";
import { getEventInsights } from "@/lib/event-insights";
import { getEventLanguageSettings } from "@/lib/event-language-server";
import { isEventArchived } from "@/lib/event-archive";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function ManageEvent({params}:{params:Promise<{id:string}>}){
 const{id}=await params;const staff=await requireEventAccess("EVENT_VIEW",id);
 const event=await db.event.findUnique({where:{id},include:{organization:true,venue:true,categories:{include:{priceTiers:true}},promoterLinks:{orderBy:{createdAt:"desc"},include:{promoter:true,category:true,table:true}},zones:{include:{tables:{include:{seatItems:true}}}}}});if(!event)notFound();
 const [commercialTerms,languageSettings,archived]=await Promise.all([getEffectiveEventTerms(event.id,event.organizationId),getEventLanguageSettings(event.id),isEventArchived(event.id)]);
 const demoAccount=staff.role==="ADMIN"?await ensureDemoOrganizerAccount(event.organizationId):null;
 const now=new Date();
 const managedCategories=event.categories.map((category)=>{const status=describeCategoryPrice(category,now);return{id:category.id,name:category.name,description:category.description,priceMinor:category.priceMinor,pricingMode:category.pricingMode,capacity:category.capacity,sold:category.sold,hidden:category.hidden,colorHex:category.colorHex,maxPerOrder:category.maxPerOrder,salesStart:category.salesStart?category.salesStart.toISOString():null,salesEnd:category.salesEnd?category.salesEnd.toISOString():null,priceTiers:category.priceTiers.map((tier)=>({id:tier.id,label:tier.label,priceMinor:tier.priceMinor,startsAt:tier.startsAt.toISOString(),endsAt:tier.endsAt.toISOString()})),currentPriceMinor:status.currentPriceMinor,statusLabel:status.statusLabel,nextTierPriceMinor:status.nextTier?.priceMinor,nextTierStartsAt:status.nextTier?.startsAt.toISOString()};});
 const tables=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,seats:item.seats,categoryId:item.categoryId})));
 const media=parseEventMedia(event.description);const buyerQuestions=parseBuyerQuestions(event.description);const guestFields=parseGuestFields(event.description);const eventType=parseEventType(event.description);const eventInsights=await getEventInsights(event.id,eventType);const cleanDescription=stripEventType(stripEventMarkers(stripBuyerQuestions(stripEventRejectionMessage(stripEventMedia(event.description)))));const rejectionMessage=parseEventRejectionMessage(event.description);
 return <AdminShell>
  {staff.role==="ADMIN"?<div className="admin-context-banner"><div><span className="eyebrow">Суперадминистратор Atlas</span><strong>Ты просматриваешь мероприятие организатора {event.organization.name}</strong><small>Коммерческие условия компании задаются на уровне организатора. Ниже можно управлять исключениями конкретного мероприятия.</small></div><span className="pill">Полный доступ</span></div>:<div className="organizer-context-banner"><div><span className="eyebrow">Кабинет организатора</span><strong>{event.organization.name}</strong><small>Здесь отображаются только доступные тебе мероприятия и разрешённые настройки.</small></div><span className="pill">Организатор</span></div>}
  {demoAccount&&<div className="demo-account-card"><div><span className="eyebrow">Тестовый аккаунт организатора</span><h3>Доступ для проверки кабинета</h3><p className="muted">Аккаунту назначены два мероприятия: {demoAccount.events.map(item=>item.title).join(", ")||"мероприятия пока отсутствуют"}.</p></div><div className="demo-credentials"><span>Email</span><strong>{demoAccount.email}</strong><span>Временный пароль</span><strong>{demoAccount.temporaryPassword}</strong></div></div>}
  <span className="eyebrow">Event manager</span><h1>{event.title}</h1><div className="stats"><div className="stat"><span className="muted">Статус</span><strong>{archived?"ARCHIVED":event.status}</strong></div><div className="stat"><span className="muted">Продажа</span><strong>{archived?"Остановлена":event.salesMode==="INSTANT"?"Автоматически":"По одобрению"}</strong></div><div className="stat"><span className="muted">VIP-столов</span><strong>{event.zones.reduce((sum,zone)=>sum+zone.tables.length,0)}</strong></div></div>
  {(staff.permissionSet.has("EVENT_MANAGE")||staff.permissionSet.has("TICKET_MANAGE"))&&<EventAtlasAssistant event={{id:event.id,title:event.title,status:archived?"ARCHIVED":event.status,salesMode:event.salesMode,startsAt:event.startsAt.toISOString(),venue:`${event.venue.name}, ${event.venue.city}`,categories:event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor,capacity:item.capacity,sold:item.sold,pricingMode:item.pricingMode}))}}/>}
  {staff.permissionSet.has("TICKET_MANAGE")?<CategoryManager eventId={event.id} categories={managedCategories}/>:<div className="table-wrap"><table><thead><tr><th>Категория</th><th>Цена сейчас</th><th>Продано</th><th>Остаток</th></tr></thead><tbody>{managedCategories.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.currentPriceMinor!==null?money(item.currentPriceMinor):item.statusLabel}</td><td>{item.sold}</td><td>{item.capacity-item.sold}</td></tr>)}</tbody></table></div>}
  {(staff.permissionSet.has("EVENT_MANAGE")||staff.permissionSet.has("TICKET_MANAGE"))&&<div className="settings-page-head"><div><span className="eyebrow">Настройки мероприятия</span><h2>Управление событием</h2><p className="muted">Коммерческие условия, язык, аудитория, форма покупателя и билет.</p></div>{staff.permissionSet.has("TICKET_MANAGE")&&<Link className="btn dark" href={`/office/events/${event.id}/ticket-design`}>Открыть редактор билета</Link>}</div>}
  {staff.permissionSet.has("EVENT_MANAGE")&&<EventArchiveControl eventId={event.id} eventTitle={event.title} archived={archived}/>} 
  {archived&&<div className="panel"><strong>Редактирование публикации заблокировано</strong><p className="muted">Сначала восстановите мероприятие из архива. После восстановления оно останется черновиком.</p></div>}
  {!archived&&staff.permissionSet.has("EVENT_MANAGE")&&<EventCommercialTermsForm eventId={event.id} organizerName={event.organization.name} isSuperAdmin={staff.role==="ADMIN"} initial={{useOrganizerDefaults:commercialTerms.useOrganizerDefaults,serviceFeePayer:commercialTerms.serviceFeePayer,organizerServiceFeePayer:commercialTerms.organizer.serviceFeePayer}}/>}
  {!archived&&staff.permissionSet.has("EVENT_MANAGE")&&<EventLanguageManager eventId={event.id} initial={languageSettings}/>} 
  {!archived&&staff.permissionSet.has("EVENT_MANAGE")&&<EventTypeManager eventId={event.id} initialType={eventType} initialInsights={eventInsights}/>} 
  {!archived&&staff.permissionSet.has("EVENT_MANAGE")&&<CheckoutFormManager eventId={event.id} initialGuestFields={guestFields} initialQuestions={buyerQuestions}/>} 
  {!archived&&staff.permissionSet.has("EVENT_MANAGE")&&<EventManager event={{id:event.id,title:event.title,description:cleanDescription,posterUrl:event.posterUrl,media,rejectionMessage,status:event.status,startsAt:event.startsAt.toISOString(),salesMode:event.salesMode,approvalInstructions:event.approvalInstructions,mapEnabled:event.mapEnabled,venueName:event.venue.name,city:event.venue.city,address:event.venue.address}}/>}
  {!archived&&staff.permissionSet.has("TICKET_MANAGE")&&<PricingStrategyManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,pricingMode:item.pricingMode,strategy:parsePricingMarketingStrategy(item.description)}))}/>} 
  {!archived&&staff.permissionSet.has("EVENT_MANAGE")&&<GuestLinkManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor}))} tables={tables} existingLinks={event.promoterLinks.map(item=>{const guest=item.promoter.name.startsWith("__GUEST_LIST__")||item.promoter.name.startsWith("__CHANNEL__:GUEST:");const allocation=item.table?`Стол ${item.table.label}`:item.category?`Категория ${item.category.name}`:"Все билеты";const priceLabel=item.customPriceMinor===0?"0 ₪":item.customPriceMinor!=null?money(item.customPriceMinor):"обычная цена";return{id:item.id,label:item.label,code:item.code,kind:guest?"GUEST" as const:"SALES" as const,allocation,priceLabel,limit:item.guestLimit,publicPath:guest?`/g/${item.code}`:`/events/${event.slug}?channel=${item.code}`,managePath:guest?`/g/${item.code}?token=${guestManagementToken(item.id)}`:null}})}/>} 
  {!archived&&event.mapEnabled&&staff.permissionSet.has("TICKET_MANAGE")&&<FullscreenVenueEditor><VenueMapEditor eventId={event.id} categories={event.categories.map(category=>({id:category.id,name:category.name,priceMinor:category.priceMinor,colorHex:category.colorHex}))} initialObjects={event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:item.label,objectType:item.objectType,seats:item.seats,priceMode:item.priceMode,priceMinor:item.priceMinor,x:item.x,y:item.y,rotation:item.rotation,width:item.width,height:item.height,categoryId:item.categoryId,reserved:item.reserved||item.seatItems.some(seat=>seat.status!=="AVAILABLE"),seatAssignments:item.seatItems.map(seat=>({position:seat.position,categoryId:seat.categoryId}))})))}/></FullscreenVenueEditor>}
 </AdminShell>;
}
