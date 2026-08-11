import { requirePromoter } from "@/lib/promoter-auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export default async function PromoterSalesPage(){
 const promoter=await requirePromoter();
 const orders=await db.order.findMany({where:{status:'PAID',promoterLink:{promoterId:promoter.id}},include:{event:true,items:true,promoterLink:true},orderBy:{createdAt:'desc'},take:200});
 return <><div><div style={{fontSize:13,textTransform:'uppercase',letterSpacing:'.12em',color:'#667085'}}>Мои продажи</div><h1 style={{fontSize:34,margin:'8px 0'}}>Продажи</h1><p style={{color:'#667085'}}>Показываются только продажи, атрибутированные вашим персональным ссылкам. Персональные данные покупателей скрыты.</p></div><div style={{marginTop:24,background:'white',border:'1px solid #eaecf0',borderRadius:16,overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Дата','Мероприятие','Билеты','Сумма'].map(h=><th key={h} style={{textAlign:'left',padding:14,borderBottom:'1px solid #eaecf0',color:'#667085',fontSize:12}}>{h}</th>)}</tr></thead><tbody>{orders.map(o=><tr key={o.id}><td style={{padding:14,borderBottom:'1px solid #f2f4f7'}}>{o.createdAt.toLocaleString('ru-RU')}</td><td style={{padding:14,borderBottom:'1px solid #f2f4f7'}}>{o.event.title}</td><td style={{padding:14,borderBottom:'1px solid #f2f4f7'}}>{o.items.reduce((s,i)=>s+i.quantity,0)}</td><td style={{padding:14,borderBottom:'1px solid #f2f4f7'}}><strong>{money(o.totalMinor)}</strong></td></tr>)}{!orders.length&&<tr><td colSpan={4} style={{padding:22,color:'#667085'}}>Продаж пока нет.</td></tr>}</tbody></table></div></>;
}
