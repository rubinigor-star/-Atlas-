import { PrismaClient, EventStatus, OrderStatus, PriceMode, Role, TicketStatus } from "@prisma/client";
import { orderNumber, ticketCode } from "../src/lib/ticketing";
const db = new PrismaClient();
async function main(){
  await db.scan.deleteMany(); await db.ticket.deleteMany(); await db.orderItem.deleteMany(); await db.order.deleteMany(); await db.promoCode.deleteMany(); await db.referral.deleteMany(); await db.table.deleteMany(); await db.zone.deleteMany(); await db.ticketCategory.deleteMany(); await db.event.deleteMany(); await db.venue.deleteMany(); await db.user.deleteMany(); await db.organization.deleteMany();
  const org=await db.organization.create({data:{name:"Atlas Live Israel"}});
  await db.user.createMany({data:[{name:"Maya Organizer",email:"organizer@atlas.test",role:Role.ORGANIZER,organizationId:org.id},{name:"Door Team",email:"scanner@atlas.test",role:Role.CHECKIN,organizationId:org.id},{name:"Atlas Admin",email:"admin@atlas.test",role:Role.ADMIN}]});
  const venue=await db.venue.create({data:{name:"Hangar 11",city:"Tel Aviv",address:"Yordei HaSira 1, Tel Aviv-Yafo"}});
  const event=await db.event.create({data:{slug:"noa-electric-tel-aviv",title:"NOA ELECTRIC - LIVE",description:"Большое ночное шоу на берегу Средиземного моря: живой вокал, электронный звук и сценическая постановка, созданная специально для Тель-Авива.",posterUrl:"/assets/noa-live-tel-aviv.png",startsAt:new Date("2026-09-18T18:30:00.000Z"),salesStart:new Date("2026-07-01T00:00:00.000Z"),salesEnd:new Date("2026-09-18T15:00:00.000Z"),status:EventStatus.PUBLISHED,organizationId:org.id,venueId:venue.id}});
  const regular=await db.ticketCategory.create({data:{name:"General Admission",description:"Вход в танцевальную зону",priceMinor:14900,capacity:450,sold:2,eventId:event.id}});
  await db.ticketCategory.createMany({data:[{name:"Golden Ring",description:"Зона у сцены",priceMinor:23900,capacity:120,sold:0,eventId:event.id},{name:"VIP Table",description:"Место за VIP-столом",priceMinor:34900,capacity:48,sold:0,eventId:event.id}]});
  const zone=await db.zone.create({data:{name:"VIP Lounge",eventId:event.id}});
  await db.table.createMany({data:Array.from({length:8},(_,i)=>({label:`V${i+1}`,seats:6,priceMinor:189000,priceMode:PriceMode.WHOLE_TABLE,zoneId:zone.id}))});
  await db.promoCode.create({data:{code:"ATLAS10",discountPercent:10,eventId:event.id}}); await db.referral.create({data:{code:"MALINA",label:"Malina audience",eventId:event.id}});
  const order=await db.order.create({data:{publicId:orderNumber(),idempotencyKey:crypto.randomUUID(),customerName:"Demo Buyer",customerEmail:"buyer@atlas.test",customerPhone:"+972525138899",totalMinor:29800,status:OrderStatus.PAID,eventId:event.id,items:{create:{quantity:2,unitPriceMinor:14900,categoryName:regular.name}}}});
  await db.ticket.createMany({data:[{publicCode:ticketCode(),holderName:order.customerName,status:TicketStatus.VALID,categoryId:regular.id,orderId:order.id},{publicCode:ticketCode(),holderName:order.customerName,status:TicketStatus.CANCELLED,categoryId:regular.id,orderId:order.id}]});
  console.log(`Seeded ${event.title} and order ${order.publicId}`);
}
main().finally(()=>db.$disconnect());
