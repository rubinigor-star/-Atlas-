import { NextResponse } from "next/server";
import { getCurrentStaff, canAccessEvent } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizerFinanceEvent } from "@/lib/finance";

function csvCell(value:unknown){const text=String(value??"");return `"${text.replaceAll('"','""')}"`;}
function moneyMinor(value:number){return (value/100).toFixed(2);}
function iso(date:Date){return new Date(date).toISOString();}

export async function GET(_request:Request,{params}:{params:Promise<{eventId:string}>}){
  const staff=await getCurrentStaff();
  if(!staff)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const {eventId}=await params;
  const event=await db.event.findUnique({where:{id:eventId},select:{organizationId:true,title:true}});
  if(!event)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  if(staff.role!=="ADMIN"){
    if(!staff.permissionSet.has("FINANCE_VIEW")||staff.organizationId!==event.organizationId||!canAccessEvent(staff,eventId))return NextResponse.json({error:"FORBIDDEN"},{status:403});
  }
  const data=await organizerFinanceEvent(event.organizationId,eventId);
  if(!data)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const {event:finance,transactions}=data;
  const rows:string[]=[];
  rows.push(["Atlas One event financial report"].map(csvCell).join(","));
  rows.push(["Event",finance.eventTitle].map(csvCell).join(","));
  rows.push(["Event date",iso(finance.eventStartsAt)].map(csvCell).join(","));
  rows.push(["Organizer sales",moneyMinor(finance.salesMinor),"ILS"].map(csvCell).join(","));
  rows.push(["Refunds and cancellation charges",moneyMinor(finance.refundsMinor),"ILS"].map(csvCell).join(","));
  rows.push(["Additional services",moneyMinor(finance.servicesMinor),"ILS"].map(csvCell).join(","));
  rows.push(["Current balance",moneyMinor(finance.balanceMinor-finance.paidOutMinor),"ILS"].map(csvCell).join(","));
  rows.push(["Paid out",moneyMinor(finance.paidOutMinor),"ILS"].map(csvCell).join(","));
  rows.push(["Available for payout",moneyMinor(finance.availableMinor),"ILS"].map(csvCell).join(","));
  rows.push("");
  rows.push(["Date","Type","Reference","Description","Amount ILS"].map(csvCell).join(","));
  for(const tx of transactions)rows.push([iso(tx.createdAt),tx.type,tx.publicId,tx.description,moneyMinor(tx.amountMinor)].map(csvCell).join(","));
  const csv=`\uFEFF${rows.join("\r\n")}`;
  const safe=(finance.eventTitle||"event").replace(/[^a-zA-Z0-9а-яА-Яא-ת_-]+/g,"-").slice(0,80);
  return new NextResponse(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="atlas-${safe}-finance.csv"`,"cache-control":"no-store"}});
}
