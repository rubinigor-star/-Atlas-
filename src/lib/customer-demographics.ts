import { db } from "@/lib/db";

export type CustomerGender="MALE"|"FEMALE";
export type OrderDemographics={orderId:string;gender:CustomerGender;birthDate:Date|null};

let ready:Promise<void>|null=null;
export function ensureCustomerDemographicsRuntime(){
  if(!ready)ready=(async()=>{
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderDemographics" ("orderId" TEXT PRIMARY KEY,"gender" TEXT NOT NULL,"birthDate" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GuestDemographics" ("guestId" TEXT PRIMARY KEY,"gender" TEXT NOT NULL,"birthDate" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  })();
  return ready;
}

export async function saveCustomerDemographics(input:{orderId:string;guestId?:string|null;gender:CustomerGender;birthDate?:Date|null}){
  await ensureCustomerDemographicsRuntime();
  const birthDate=input.birthDate??null;
  await db.$executeRawUnsafe(`INSERT INTO "OrderDemographics" ("orderId","gender","birthDate","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT ("orderId") DO UPDATE SET "gender"=excluded."gender","birthDate"=excluded."birthDate","updatedAt"=CURRENT_TIMESTAMP`,input.orderId,input.gender,birthDate);
  if(input.guestId)await db.$executeRawUnsafe(`INSERT INTO "GuestDemographics" ("guestId","gender","birthDate","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT ("guestId") DO UPDATE SET "gender"=excluded."gender","birthDate"=excluded."birthDate","updatedAt"=CURRENT_TIMESTAMP`,input.guestId,input.gender,birthDate);
}

export async function getOrderDemographics(orderId:string){
  await ensureCustomerDemographicsRuntime();
  const rows=await db.$queryRawUnsafe<OrderDemographics[]>(`SELECT "orderId","gender","birthDate" FROM "OrderDemographics" WHERE "orderId"=$1 LIMIT 1`,orderId);
  return rows[0]??null;
}

export async function getOrderDemographicsForOrders(orderIds:string[]){
  await ensureCustomerDemographicsRuntime();
  if(!orderIds.length)return new Map<string,OrderDemographics>();
  const placeholders=orderIds.map((_,index)=>`$${index+1}`).join(",");
  const rows=await db.$queryRawUnsafe<OrderDemographics[]>(`SELECT "orderId","gender","birthDate" FROM "OrderDemographics" WHERE "orderId" IN (${placeholders})`,...orderIds);
  return new Map(rows.map((row)=>[row.orderId,row]));
}

export async function getAllOrderDemographics(){
  await ensureCustomerDemographicsRuntime();
  return db.$queryRawUnsafe<OrderDemographics[]>(`SELECT "orderId","gender","birthDate" FROM "OrderDemographics"`);
}

export function ageAt(birthDate:Date|null|undefined,at=new Date()){
  if(!birthDate)return null;
  const birth=new Date(birthDate);if(Number.isNaN(birth.getTime())||birth.getUTCFullYear()<1901)return null;
  let age=at.getUTCFullYear()-birth.getUTCFullYear();
  const beforeBirthday=at.getUTCMonth()<birth.getUTCMonth()||(at.getUTCMonth()===birth.getUTCMonth()&&at.getUTCDate()<birth.getUTCDate());
  if(beforeBirthday)age-=1;
  return age>=0&&age<120?age:null;
}
