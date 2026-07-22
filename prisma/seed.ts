import { PrismaClient, EventStatus, OrderStatus, PriceMode, Role, SeatingObjectType, StaffRole, TicketStatus } from "@prisma/client";
import { orderNumber, ticketCode } from "../src/lib/ticketing";
import { rolePermissions } from "../src/lib/permissions";
const db = new PrismaClient();
async function main(){
  await db.auditLog.deleteMany(); await db.permissionGrant.deleteMany(); await db.eventStaffAccess.deleteMany(); await db.scan.deleteMany(); await db.ticket.deleteMany(); await db.orderItem.deleteMany(); await db.order.deleteMany(); await db.promoCode.deleteMany(); await db.referral.deleteMany(); await db.seat.deleteMany(); await db.table.deleteMany(); await db.zone.deleteMany(); await db.ticketCategory.deleteMany(); await db.event.deleteMany(); await db.venue.deleteMany(); await db.user.deleteMany(); await db.organization.deleteMany();
  const org=await db.organization.create({data:{name:"Atlas Live Israel"}});
  const staff=[
    {name:"Maya Organizer",email:"organizer@atlas.test",role:Role.ORGANIZER,staffRole:StaffRole.OWNER,jobTitle:"Владелец организации"},
    {name:"Alex Event Manager",email:"manager@atlas.test",role:Role.ORGANIZER,staffRole:StaffRole.EVENT_MANAGER,jobTitle:"Менеджер мероприятий"},
    {name:"Dana Face Control",email:"approver@atlas.test",role:Role.ORGANIZER,staffRole:StaffRole.APPROVER,jobTitle:"Face control"},
    {name:"Door Team",email:"scanner@atlas.test",role:Role.CHECKIN,staffRole:StaffRole.CHECKIN,jobTitle:"Контроль входа"},
  ];
  for(const member of staff){await db.user.create({data:{...member,organizationId:org.id,permissions:{create:rolePermissions[member.staffRole].map((permission)=>({permission}))}}});}
  await db.user.create({data:{name:"Atlas Admin",email:"admin@atlas.test",role:Role.ADMIN,staffRole:StaffRole.ADMIN,jobTitle:"Администратор платформы"}});
  const venue=await db.venue.create({data:{name:"Hangar 11",city:"Tel Aviv",address:"Yordei HaSira 1, Tel Aviv-Yafo"}});
  const event=await db.event.create({data:{slug:"noa-electric-tel-aviv",title:"NOA ELECTRIC - LIVE",description:"Большое ночное шоу на берегу Средиземного моря: живой вокал, электронный звук и сценическая постановка, созданная специально для Тель-Авива.",posterUrl:"/assets/noa-live-tel-aviv.png",startsAt:new Date("2026-09-18T18:30:00.000Z"),salesStart:new Date("2026-07-01T00:00:00.000Z"),salesEnd:new Date("2026-09-18T15:00:00.000Z"),status:EventStatus.PUBLISHED,salesMode:"APPROVAL_REQUIRED",approvalInstructions:"Укажите номер клубной карты или кто вас пригласил",mapEnabled:true,mapName:"Hangar 11 Main Hall",organizationId:org.id,venueId:venue.id}});
  const regular=await db.ticketCategory.create({data:{name:"General Admission",description:"Вход в танцевальную зону",colorHex:"#2563EB",priceMinor:14900,capacity:450,sold:2,eventId:event.id}});
  const golden=await db.ticketCategory.create({data:{name:"Golden Ring",description:"Зона у сцены",colorHex:"#9333EA",priceMinor:23900,capacity:120,sold:0,eventId:event.id}});
  const vip=await db.ticketCategory.create({data:{name:"VIP Seating",description:"Столы, диваны и отдельные VIP-места",colorHex:"#D97706",priceMinor:34900,capacity:80,sold:0,eventId:event.id}});
  const zone=await db.zone.create({data:{name:"Основной зал",eventId:event.id}});
  const layout=[
    {label:"T1",objectType:SeatingObjectType.TABLE,seats:6,priceMinor:189000,priceMode:PriceMode.WHOLE_TABLE,x:22,y:40,rotation:0,width:170,height:100},
    {label:"T2",objectType:SeatingObjectType.ROUND_TABLE,seats:6,priceMinor:189000,priceMode:PriceMode.WHOLE_TABLE,x:50,y:40,rotation:0,width:130,height:130},
    {label:"T3",objectType:SeatingObjectType.TABLE,seats:6,priceMinor:34900,priceMode:PriceMode.PER_SEAT,x:78,y:40,rotation:0,width:170,height:100},
    {label:"S1",objectType:SeatingObjectType.SOFA,seats:4,priceMinor:120000,priceMode:PriceMode.WHOLE_TABLE,x:30,y:72,rotation:0,width:190,height:86},
    {label:"S2",objectType:SeatingObjectType.SOFA,seats:4,priceMinor:29900,priceMode:PriceMode.PER_SEAT,x:70,y:72,rotation:0,width:190,height:86},
  ];
  for(const item of layout){await db.table.create({data:{...item,zoneId:zone.id,categoryId:vip.id,seatItems:{create:Array.from({length:item.seats},(_,index)=>({label:`${item.label}-${index+1}`,position:index+1,categoryId:item.priceMode===PriceMode.PER_SEAT?(index<Math.ceil(item.seats/2)?golden.id:vip.id):null}))}}});}
  await db.table.createMany({data:[
    {label:"СЦЕНА",objectType:SeatingObjectType.STAGE,seats:0,priceMinor:0,priceMode:PriceMode.WHOLE_TABLE,x:50,y:12,rotation:0,width:430,height:90,zoneId:zone.id},
    {label:"ТАНЦПОЛ",objectType:SeatingObjectType.ZONE,seats:0,priceMinor:0,priceMode:PriceMode.WHOLE_TABLE,x:50,y:47,rotation:0,width:420,height:250,zoneId:zone.id},
    {label:"ЦЕНТРАЛЬНЫЙ БАР",objectType:SeatingObjectType.BAR,seats:0,priceMinor:0,priceMode:PriceMode.WHOLE_TABLE,x:50,y:88,rotation:0,width:320,height:68,zoneId:zone.id},
  ]});
  await db.promoCode.create({data:{code:"ATLAS10",discountPercent:10,eventId:event.id}}); await db.referral.create({data:{code:"MALINA",label:"Malina audience",eventId:event.id}});
  const order=await db.order.create({data:{publicId:orderNumber(),idempotencyKey:crypto.randomUUID(),customerName:"Demo Buyer",customerEmail:"buyer@atlas.test",customerPhone:"+972525138899",totalMinor:29800,status:OrderStatus.PAID,eventId:event.id,items:{create:{quantity:2,unitPriceMinor:14900,categoryName:regular.name}}}});
  await db.order.create({data:{publicId:orderNumber(),idempotencyKey:crypto.randomUUID(),customerName:"Igor Levin",customerEmail:"igor.levin@example.com",customerPhone:"+972501112233",eligibilityAnswer:"Клубная карта MLN-2841",totalMinor:34900,status:OrderStatus.PENDING_APPROVAL,eventId:event.id,items:{create:{quantity:1,unitPriceMinor:34900,categoryName:vip.name}}}});
  await db.order.create({data:{publicId:orderNumber(),idempotencyKey:crypto.randomUUID(),customerName:"Anna Cohen",customerEmail:"anna@example.com",customerPhone:"+972522223344",eligibilityAnswer:"Приглашение от Maya",totalMinor:47800,status:OrderStatus.PENDING_APPROVAL,eventId:event.id,items:{create:{quantity:2,unitPriceMinor:23900,categoryName:golden.name}}}});
  await db.ticket.createMany({data:[{publicCode:ticketCode(),holderName:order.customerName,status:TicketStatus.VALID,categoryId:regular.id,orderId:order.id},{publicCode:ticketCode(),holderName:order.customerName,status:TicketStatus.CANCELLED,categoryId:regular.id,orderId:order.id}]});
  console.log(`Seeded ${event.title} and order ${order.publicId}`);
}
main().finally(()=>db.$disconnect());
