import { PrismaClient } from "@prisma/client";

const db=new PrismaClient();
const events=[
 {slug:"echoes-of-light",title:"Echoes of Light Live",date:"2026-08-15T20:00:00+03:00",venue:"Hangar 11",city:"Tel Aviv",address:"Yordei HaSira 1",description:"Большой живой концерт со световым шоу и современной сценографией."},
 {slug:"neon-dreams",title:"Neon Dreams",date:"2026-09-14T22:30:00+03:00",venue:"Hangar 11",city:"Tel Aviv",address:"Yordei HaSira 1",description:"Электронная ночь, неоновые декорации и иммерсивный танцпол."},
 {slug:"stand-up-night",title:"Stand Up Night",date:"2026-10-21T21:00:00+03:00",venue:"The Box",city:"Tel Aviv",address:"Carlebach 12",description:"Вечер современной комедии с несколькими артистами и живой атмосферой."},
 {slug:"sunset-sessions",title:"Sunset Sessions Festival",date:"2026-11-18T16:00:00+02:00",venue:"Charles Clore Beach",city:"Tel Aviv",address:"Charles Clore Park",description:"Музыкальный фестиваль на закате у моря с несколькими сценами."},
 {slug:"techno-united",title:"Techno United",date:"2026-12-23T23:00:00+02:00",venue:"The Block",city:"Tel Aviv",address:"Salame 157",description:"Ночной indoor rave с мощным звуком, лазерами и международным лайнапом."},
 {slug:"magic-adventure",title:"Magic Adventure",date:"2027-01-16T11:00:00+02:00",venue:"Heichal HaTarbut",city:"Tel Aviv",address:"Huberman 1",description:"Красочное семейное шоу с иллюзиями, музыкой и интерактивными героями."},
 {slug:"jazz-nights",title:"Jazz Nights Live",date:"2027-02-17T20:30:00+02:00",venue:"Hangar 11",city:"Tel Aviv",address:"Yordei HaSira 1",description:"Живой джазовый вечер с большим ансамблем и атмосферной сценой."},
 {slug:"pool-party",title:"Pool Party — Winter Escape",date:"2027-03-22T15:00:00+02:00",venue:"Atlas Rooftop",city:"Tel Aviv",address:"HaYarkon 88",description:"Дневная rooftop-вечеринка с бассейном, диджеями и яркой фотозоной."},
];

try{
 const organization=await db.organization.findFirst({orderBy:{createdAt:"asc"}});
 if(!organization){console.log("No organization found; skipping showcase events.");process.exit(0);}
 const salesStart=new Date("2026-07-01T00:00:00+03:00");
 for(const item of events){
   const venue=await db.venue.upsert({where:{id:`showcase-venue-${item.slug}`},update:{name:item.venue,city:item.city,address:item.address},create:{id:`showcase-venue-${item.slug}`,name:item.venue,city:item.city,address:item.address}});
   const startsAt=new Date(item.date);
   const salesEnd=new Date(startsAt.getTime()-60*60*1000);
   const posterUrl=`/events/${item.slug}.svg`;
   const event=await db.event.upsert({where:{slug:item.slug},update:{title:item.title,description:item.description,posterUrl,startsAt,salesStart,salesEnd,status:"PUBLISHED",salesMode:"INSTANT",organizationId:organization.id,venueId:venue.id},create:{slug:item.slug,title:item.title,description:item.description,posterUrl,startsAt,salesStart,salesEnd,status:"PUBLISHED",salesMode:"INSTANT",organizationId:organization.id,venueId:venue.id}});
   const categories=[
    {name:"General Admission",description:"Вход в основную зону",colorHex:"#2563EB"},
    {name:"Golden Ring",description:"Зона ближе к сцене",colorHex:"#F59E0B"},
    {name:"VIP Seating",description:"VIP-зона и отдельный вход",colorHex:"#8B5CF6"},
   ];
   for(const category of categories)await db.ticketCategory.upsert({where:{eventId_name:{eventId:event.id,name:category.name}},update:{description:category.description,priceMinor:100,currency:"ILS",capacity:500,hidden:false,colorHex:category.colorHex,minPerOrder:1,maxPerOrder:10},create:{eventId:event.id,name:category.name,description:category.description,priceMinor:100,currency:"ILS",capacity:500,hidden:false,colorHex:category.colorHex,minPerOrder:1,maxPerOrder:10}});
 }
 console.log(`Showcase ready: ${events.length} published events with ₪1 tickets and static posters.`);
}finally{await db.$disconnect();}
