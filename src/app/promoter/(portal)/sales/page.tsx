import { requirePromoterV2 } from "@/lib/promoter-auth-v2";
import { listAssignmentsV2 } from "@/lib/promoter-v2";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

type SaleRow={id:string;createdAt:Date;eventTitle:string;totalMinor:number;tickets:number};

export default async function PromoterSalesPage(){
 const promoter=await requirePromoterV2();const assignments=await listAssignmentsV2(promoter.id);const codes=assignments.map(a=>a.code);
 const orders=codes.length?await db.$queryRawUnsafe<SaleRow[]>(`SELECT o."id",o."createdAt",e."title" AS "eventTitle",o."totalMinor",COALESCE(SUM(oi."quantity"),0)::int AS "tickets" FROM "Order" o JOIN "Referral" r ON r."id"=o."referralId" JOIN "Event" e ON e."id"=o."eventId" LEFT JOIN "OrderItem" oi ON oi."orderId"=o."id" WHERE o."status"='PAID' AND UPPER(r."code")=ANY($1::text[]) GROUP BY o."id",e."title" ORDER BY o."createdAt" DESC LIMIT 200`,codes.map(c=>c.toUpperCase())):[];
 return <><div><div style={{fontSize:13,textTransform:"uppercase",letterSpacing:".12em",color:"#667085"}}>Мои продажи</div><h1 style={{fontSize:34,margin:"8px 0"}}>Продажи</h1><p style={{color:"#667085"}}>Показываются только оплаченные заказы, атрибутированные вашим V2 channel-ссылкам. Персональные данные покупателей скрыты.</p></div><div style={{marginTop:24,background:"white",border:"1px solid #eaecf0",borderRadius:16,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Дата","Мероприятие","Билеты","Сумма"].map(h=><th key={h} style={{textAlign:"left",padding:14,borderBottom:"1px solid #eaecf0",color:"#667085",fontSize:12}}>{h}</th>)}</tr></thead><tbody>{orders.map(o=><tr key={o.id}><td style={{padding:14,borderBottom:"1px solid #f2f4f7"}}>{o.createdAt.toLocaleString("ru-RU")}</td><td style={{padding:14,borderBottom:"1px solid #f2f4f7"}}>{o.eventTitle}</td><td style={{padding:14,borderBottom:"1px solid #f2f4f7"}}>{o.tickets}</td><td style={{padding:14,borderBottom:"1px solid #f2f4f7"}}><strong>{money(o.totalMinor)}</strong></td></tr>)}{!orders.length&&<tr><td colSpan={4} style={{padding:22,color:"#667085"}}>Продаж пока нет.</td></tr>}</tbody></table></div></>;
}
