import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { EventEditorWorkspace } from "@/components/event-editor-workspace";
import { EventDetailsManager } from "@/components/event-details-manager";
import { EventSalesModeManager } from "@/components/event-sales-mode-manager";
import { EventArchiveControl } from "@/components/event-archive-control";
import { EventTypeManager } from "@/components/event-type-manager";
import { EventLanguageManager } from "@/components/event-language-manager";
import { EventAtlasAssistant } from "@/components/event-atlas-assistant";
import { VenueMapEditor } from "@/components/venue-map-editor";
import { FullscreenMapPanel } from "@/components/fullscreen-map-panel";
import { GuestLinkManager } from "@/components/guest-link-manager";
import { PricingStrategyManager } from "@/components/pricing-strategy-manager";
import { CategoryManager } from "@/components/category-manager";
import { CheckoutFormManager } from "@/components/checkout-form-manager";
import { EventCommercialTermsForm } from "@/components/event-commercial-terms-form";
import { AdmissionModeManager } from "@/components/admission-mode-manager";
import { db } from "@/lib/db";
import { describeCategoryPrice } from "@/lib/ticketing";
import { requireEventAccess } from "@/lib/auth";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { parseEventMedia,stripEventMedia } from "@/lib/event-media";
import { parseEventRejectionMessage,stripEventRejectionMessage } from "@/lib/event-approval-message";
import { parseBuyerQuestions,stripBuyerQuestions } from "@/lib/buyer-questions";
import { parseGuestFields,stripEventMarkers } from "@/lib/event-guest-fields";
import { guestManagementToken } from "@/lib/guest-links";
import { parsePricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { parseEventTypes,stripEventType } from "@/lib/event-type";
import { getEventLanguageSettings } from "@/lib/event-language-server";
import { isEventArchived } from "@/lib/event-archive";

export const dynamic="force-dynamic";

type TabId="about"|"tickets"|"map"|"checkout"|"review";

export default async function ManageEvent({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{tab?:string}>}){
 const{id}=await params;const query=searchParams?await searchParams:{};const staff=await requireEventAccess("EVENT_VIEW",id);
 const event=await db.event.findUnique({where:{id},include:{organization:true,venue:true,categories:{include:{priceTiers:true}},promoterLinks:{orderBy:{createdAt:"desc"},include:{promoter:true,category:true,table:true}},zones:{include:{tables:{include:{seatItems:true}}}}}});if(!event)notFound();
 const[commercialTerms,languageSettings,archived]=await Promise.all([getEffectiveEventTerms(event.id,event.organizationId),getEventLanguageSettings(event.id),isEventArchived(event.id)]);
 const now=new Date();
 const managedCategories=event.categories.map(category=>{const status=describeCategoryPrice(category,now);return{id:category.id,name:category.name,description:category.description,priceMinor:category.priceMinor,pricingMode:category.pricingMode,capacity:category.capacity,sold:category.sold,hidden:category.hidden,colorHex:category.colorHex,maxPerOrder:category.maxPerOrder,salesStart:category.salesStart?.toISOString()??null,salesEnd:category.salesEnd?.toISOString()??null,priceTiers:category.priceTiers.map(tier=>({id:tier.id,label:tier.label,priceMinor:tier.priceMinor,startsAt:tier.startsAt.toISOString(),endsAt:tier.endsAt.toISOString()})),currentPriceMinor:status.currentPriceMinor,statusLabel:status.statusLabel,nextTierPriceMinor:status.nextTier?.priceMinor,nextTierStartsAt:status.nextTier?.startsAt.toISOString()};});
 const tables=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,seats:item.seats,categoryId:item.categoryId})));
 const media=parseEventMedia(event.description);const buyerQuestions=parseBuyerQuestions(event.description);const guestFields=parseGuestFields(event.description);const eventTypes=parseEventTypes(event.description);const cleanDescription=stripEventType(stripEventMarkers(stripBuyerQuestions(stripEventRejectionMessage(stripEventMedia(event.description)))));const rejectionMessage=parseEventRejectionMessage(event.description);
 const canManage=staff.permissionSet.has("EVENT_MANAGE");const canTickets=staff.permissionSet.has("TICKET_MANAGE");
 const allowedTabs=new Set<TabId>(["about","tickets","map","checkout","review"]);const initialTab=allowedTabs.has(query.tab as TabId)?query.tab as TabId:"about";

 const about=<div className="stack">{canManage&&<EventTypeManager eventId={event.id} initialTypes={eventTypes}/>} {canManage&&<EventLanguageManager eventId={event.id} initial={languageSettings}/>} {canManage&&<EventDetailsManager event={{id:event.id,title:event.title,description:cleanDescription,posterUrl:event.posterUrl,media,startsAt:event.startsAt.toISOString(),venueName:event.venue.name,city:event.venue.city,address:event.venue.address}}/>}</div>;

 const tickets=<div className="stack">{canTickets&&<CategoryManager eventId={event.id} categories={managedCategories}/>} {canTickets&&<PricingStrategyManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,pricingMode:item.pricingMode,strategy:parsePricingMarketingStrategy(item.description)}))}/>}</div>;

 const map=<div className="stack">{(canManage||canTickets)&&<AdmissionModeManager eventId={event.id} initialMapEnabled={event.mapEnabled}/>} {event.mapEnabled&&canTickets?<FullscreenMapPanel><VenueMapEditor eventId={event.id} categories={event.categories.map(category=>({id:category.id,name:category.name,priceMinor:category.priceMinor,colorHex:category.colorHex}))} initialObjects={event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:item.label,objectType:item.objectType,seats:item.seats,priceMode:item.priceMode,priceMinor:item.priceMinor,x:item.x,y:item.y,rotation:item.rotation,width:item.width,height:item.height,categoryId:item.categoryId,reserved:item.reserved||item.seatItems.some(seat=>seat.status!=="AVAILABLE"),seatAssignments:item.seatItems.map(seat=>({position:seat.position,categoryId:seat.categoryId}))})))}/></FullscreenMapPanel>:event.mapEnabled?<div className="panel">У вас нет доступа к редактированию карты.</div>:<section className="panel"><h2>Карта не используется</h2><p className="muted">Покупатель выбирает тип и количество билетов без выбора места.</p></section>}</div>;

 const checkout=<div className="stack">{canManage&&<EventSalesModeManager eventId={event.id} initialMode={event.salesMode} initialInstructions={event.approvalInstructions} initialRejectionMessage={rejectionMessage}/>} {canManage&&<CheckoutFormManager eventId={event.id} initialGuestFields={guestFields} initialQuestions={buyerQuestions}/>} {canManage&&<EventCommercialTermsForm eventId={event.id} organizerName={event.organization.name} isSuperAdmin={staff.role==="ADMIN"} initial={{useOrganizerDefaults:commercialTerms.useOrganizerDefaults,serviceFeePayer:commercialTerms.serviceFeePayer,organizerServiceFeePayer:commercialTerms.organizer.serviceFeePayer}}/>} {canTickets&&<section className="panel"><span className="eyebrow">Билет покупателя</span><h2>Дизайн и выдача билета</h2><p className="muted">Настройте внешний вид билета и данные, которые получает покупатель.</p><Link className="btn" href={`/office/events/${event.id}/ticket-design`}>Открыть редактор билета</Link></section>}</div>;

 const review=<div className="stack"><section className="panel"><span className="eyebrow">Проверка</span><h2>{event.title}</h2><div className="stats"><div className="stat"><span className="muted">Статус</span><strong>{archived?"ARCHIVED":event.status}</strong></div><div className="stat"><span className="muted">Формат</span><strong>{event.mapEnabled?"С выбором мест":"Без схемы"}</strong></div><div className="stat"><span className="muted">Категорий билетов</span><strong>{event.categories.length}</strong></div></div><div className="row"><Link className="btn dark" href={`/events/${event.slug}`}>Предварительный просмотр</Link></div></section>{(canManage||canTickets)&&<EventAtlasAssistant event={{id:event.id,title:event.title,status:archived?"ARCHIVED":event.status,salesMode:event.salesMode,startsAt:event.startsAt.toISOString(),venue:`${event.venue.name}, ${event.venue.city}`,categories:event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor,capacity:item.capacity,sold:item.sold,pricingMode:item.pricingMode}))}}/>}{canManage&&<EventArchiveControl eventId={event.id} eventTitle={event.title} archived={archived}/>}</div>;

 const operations=canManage?<section className="panel stack"><div><span className="eyebrow">После создания мероприятия</span><h2>Гостевые и специальные ссылки</h2><p className="muted">Этот операционный модуль сохранён отдельно и не смешивается с пятью вкладками конструктора.</p></div><GuestLinkManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor}))} tables={tables} existingLinks={event.promoterLinks.map(item=>{const guest=item.promoter.name.startsWith("__GUEST_LIST__")||item.promoter.name.startsWith("__CHANNEL__:GUEST:");return{id:item.id,label:item.label,code:item.code,kind:guest?"GUEST" as const:"SALES" as const,allocation:item.table?`Стол ${item.table.label}`:item.category?`Категория ${item.category.name}`:"Все билеты",priceLabel:item.customPriceMinor===0?"0 ₪":item.customPriceMinor!=null?`${item.customPriceMinor/100} ₪`:"обычная цена",limit:item.guestLimit,publicPath:guest?`/g/${item.code}`:`/events/${event.slug}?channel=${item.code}`,managePath:guest?`/g/${item.code}?token=${guestManagementToken(item.id)}`:null}})}/></section>:null;

 return <AdminShell><div className="row between"><div><span className="eyebrow">Единый редактор мероприятия</span><h1>{event.title}</h1><p className="muted">Каждая настройка находится только в одном разделе.</p></div><span className="pill">{event.status}</span></div><EventEditorWorkspace initialTab={initialTab} about={about} tickets={tickets} map={map} checkout={checkout} review={review}/>{operations}</AdminShell>;
}
