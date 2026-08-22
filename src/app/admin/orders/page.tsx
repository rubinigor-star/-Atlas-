import Link from "next/link";
import { UserRound, UserRoundCheck } from "lucide-react";
import { db } from "@/lib/db";
import { money, eventDate, israelDateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";
import { ageAt, getAllOrderDemographics } from "@/lib/customer-demographics";
import { getImportedOrders } from "@/lib/imported-orders";
import { resolveStaffLocale } from "@/lib/i18n";
import { officeOrdersCopy } from "@/lib/office-orders-i18n";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;

export default async function Orders({searchParams}:{searchParams?:Promise<{page?:string;view?:string}>}){
  const staff=await requirePermission("ORDER_VIEW");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=officeOrdersCopy[locale];
  const genderLabel=(value:string|null)=>value==="MALE"?text.gender.MALE:value==="FEMALE"?text.gender.FEMALE:text.gender.UNKNOWN;
  const query=searchParams?await searchParams:{};
  const requestedPage=Number.parseInt(query.page||"1",10);
  const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const view=query.view==="imported"?"imported":"atlas";
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const scopedIds=staff.eventScope==="ALL"?undefined:eventIds;

  if(view==="imported"){
    const imported=await getImportedOrders({organizationId:staff.organizationId!,eventIds:scopedIds,page,pageSize:PAGE_SIZE});
    const totalPages=Math.max(1,Math.ceil(imported.total/PAGE_SIZE));
    const currentPage=Math.min(page,totalPages);
    const rows=imported.rows.map(order=>({
      [text.export.externalOrder]:order.externalOrderId||order.key,
      [text.export.event]:order.eventTitle,
      [text.export.eventDate]:eventDate(new Date(order.startsAt)),
      [text.export.customer]:order.customerName||"-",
      [text.export.phone]:order.customerPhone||"",
      [text.export.email]:order.customerEmail||"",
      [text.export.uniqueCustomers]:order.customerCount,
      [text.export.tickets]:order.ticketCount,
      [text.export.entered]:order.usedCount,
      [text.export.cancelled]:order.cancelledCount,
      [text.export.amount]:money(order.totalMinor),
      [text.export.type]:"Imported",
      [text.export.importedAt]:israelDateTime(new Date(order.createdAt)),
    }));
    return <AdminShell>
      <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>{text.title}</h1><p>{text.importedDescription}</p></div><ExcelExportButton rows={rows} filename={`atlas-imported-orders-page-${currentPage}`}/></div>
      <div className="row" style={{marginBottom:18}}><Link className="btn secondary" href="/office/orders?view=atlas">Atlas</Link><Link className="btn" href="/office/orders?view=imported">Imported</Link></div>
      <div className="stats"><div className="stat"><span className="muted">{text.importedOrders}</span><strong>{imported.total}</strong></div><div className="stat"><span className="muted">{text.onPage}</span><strong>{imported.rows.length}</strong></div><div className="stat"><span className="muted">{text.mode}</span><strong>{text.readOnly}</strong><small>{text.noAtlasAutomation}</small></div></div>
      <div className="table-wrap"><table><thead><tr><th>{text.number}</th><th>{text.event}</th><th>{text.customer}</th><th>{text.tickets}</th><th>{text.amount}</th><th>{text.status}</th></tr></thead><tbody>{imported.rows.map(order=><tr key={order.key}><td><strong><bdi>{order.externalOrderId||text.noNumber}</bdi></strong><br/><small className="muted">Imported</small></td><td><strong>{order.eventTitle}</strong><br/><small>{eventDate(new Date(order.startsAt))}</small></td><td><strong>{order.customerName||text.importedCustomer}</strong><br/><small>{order.customerCount>1?`${order.customerCount} ${text.customersSuffix} · `:""}<bdi>{order.customerPhone||text.withoutPhone}</bdi>{order.customerEmail?<> · <bdi>{order.customerEmail}</bdi></>:null}</small></td><td>{order.ticketCount}<br/><small>{order.usedCount} {text.entered}{order.cancelledCount?` · ${order.cancelledCount} ${text.cancelled}`:""}</small></td><td><bdi>{money(order.totalMinor)}</bdi></td><td><span className="pill">IMPORTED</span></td></tr>)}{!imported.rows.length&&<tr><td colSpan={6}>{text.noImported}</td></tr>}</tbody></table></div>
      {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label={text.importedPagesAria}><div>{currentPage>1?<Link className="btn secondary" href={`/office/orders?view=imported&page=${currentPage-1}`}>{text.back}</Link>:<span/>}</div><span className="pill">{text.page} {currentPage} {text.of} {totalPages}</span><div>{currentPage<totalPages?<Link className="btn secondary" href={`/office/orders?view=imported&page=${currentPage+1}`}>{text.next}</Link>:<span/>}</div></nav>}
    </AdminShell>;
  }

  const where={event:{organizationId:staff.organizationId!},...(scopedIds?{eventId:{in:scopedIds}}:{})};
  const [total,orders,allDemographics,importedCount]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({where,select:{id:true,publicId:true,customerName:true,customerEmail:true,customerPhone:true,customerBirthDate:true,totalMinor:true,status:true,createdAt:true,event:{select:{title:true,startsAt:true}},_count:{select:{tickets:true}}},orderBy:{createdAt:"desc"},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),
    getAllOrderDemographics(),
    getImportedOrders({organizationId:staff.organizationId!,eventIds:scopedIds,page:1,pageSize:1}).then(result=>result.total),
  ]);
  const orderIds=new Set((await db.order.findMany({where,select:{id:true}})).map(item=>item.id));
  const demographics=allDemographics.filter(item=>orderIds.has(item.orderId));
  const demographicsByOrder=new Map(demographics.map(item=>[item.orderId,item]));
  const male=demographics.filter(item=>item.gender==="MALE").length;
  const female=demographics.filter(item=>item.gender==="FEMALE").length;
  const knownGender=male+female;
  const ages=demographics.map(item=>ageAt(item.birthDate)).filter((age):age is number=>age!==null);
  const avgAge=ages.length?Math.round(ages.reduce((sum,age)=>sum+age,0)/ages.length):null;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const rows=orders.map(order=>{const demo=demographicsByOrder.get(order.id);const age=ageAt(demo?.birthDate??order.customerBirthDate);return {
    [text.export.order]:order.publicId,
    [text.export.event]:order.event.title,
    [text.export.eventDate]:eventDate(order.event.startsAt),
    [text.export.customer]:order.customerName,
    [text.export.gender]:genderLabel(demo?.gender??null),
    [text.export.age]:age??"",
    [text.export.email]:order.customerEmail,
    [text.export.phone]:order.customerPhone,
    [text.export.tickets]:order._count.tickets,
    [text.export.amount]:money(order.totalMinor),
    [text.export.status]:order.status,
    [text.export.orderedAt]:israelDateTime(order.createdAt),
  };});

  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>{text.title}</h1><p>{text.atlasDescription} {text.shown} {orders.length} {text.of} {total}.</p></div><ExcelExportButton rows={rows} filename={`atlas-orders-page-${currentPage}`}/></div>
    <div className="row" style={{marginBottom:18}}><Link className="btn" href="/office/orders?view=atlas">Atlas</Link><Link className="btn secondary" href="/office/orders?view=imported">Imported {importedCount?`(${importedCount})`:""}</Link></div>
    <div className="stats"><div className="stat"><span className="muted">{text.male}</span><strong>{male}</strong><small>{knownGender?Math.round(male/knownGender*100):0}%</small></div><div className="stat"><span className="muted">{text.female}</span><strong>{female}</strong><small>{knownGender?Math.round(female/knownGender*100):0}%</small></div><div className="stat"><span className="muted">{text.averageAge}</span><strong>{avgAge??"-"}</strong><small>{ages.length?`${text.basedOn} ${ages.length} ${text.ordersGenitive}`:text.noData}</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>{text.number}</th><th>{text.event}</th><th>{text.customer}</th><th>{text.tickets}</th><th>{text.amount}</th><th>{text.status}</th></tr></thead><tbody>{orders.map(order=>{const demo=demographicsByOrder.get(order.id);const age=ageAt(demo?.birthDate??order.customerBirthDate);const gender=demo?.gender??null;return <tr key={order.id}><td><Link prefetch={false} href={`/office/orders/${order.publicId}`}><strong><bdi>{order.publicId}</bdi></strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{gender==="MALE"?<UserRound size={16}/>:gender==="FEMALE"?<UserRoundCheck size={16}/>:null}<strong>{order.customerName}</strong></span><br/><small>{genderLabel(gender)}{age!==null?` · ${age} ${text.years}`:""} · <bdi>{order.customerEmail}</bdi></small></td><td>{order._count.tickets}</td><td><bdi>{money(order.totalMinor)}</bdi></td><td><span className="pill">{order.status}</span></td></tr>})}{!orders.length&&<tr><td colSpan={6}>{text.noOrders}</td></tr>}</tbody></table></div>
    {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label={text.pagesAria}><div>{currentPage>1?<Link prefetch={false} className="btn secondary" href={`/office/orders?view=atlas&page=${currentPage-1}`}>{text.back}</Link>:<span/>}</div><span className="pill">{text.page} {currentPage} {text.of} {totalPages}</span><div>{currentPage<totalPages?<Link prefetch={false} className="btn secondary" href={`/office/orders?view=atlas&page=${currentPage+1}`}>{text.next}</Link>:<span/>}</div></nav>}
  </AdminShell>;
}
