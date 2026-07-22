import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ScannerClient } from "@/components/scanner-client";
import { AdminShell } from "@/components/admin-shell";

export const dynamic="force-dynamic";
export default async function Scanner(){
  const staff=await requirePermission("SCAN");
  const allowedEvents=staff.eventAccess.map(item=>item.eventId);
  const eventFilter={organizationId:staff.organizationId!,...(allowedEvents.length?{id:{in:allowedEvents}}:{})};
  const [entered,scans]=await Promise.all([
    db.ticket.count({where:{status:"USED",order:{event:eventFilter}}}),
    db.scan.findMany({where:{ticket:{order:{event:eventFilter}}},take:12,orderBy:{scannedAt:"desc"},include:{ticket:{include:{order:{include:{event:true}}}}}}),
  ]);
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Door control</span><h1>Сканер билетов</h1><p>Камера, ручной ввод и журнал входов в одном мобильном экране.</p></div><span className="office-live"><i/>Вошли: {entered}</span></div><div className="office-scanner"><ScannerClient initialEntered={entered}/><div className="table-wrap"><table><thead><tr><th>Время</th><th>Результат</th><th>Мероприятие</th><th>Код</th></tr></thead><tbody>{scans.map(scan=><tr key={scan.id}><td>{scan.scannedAt.toLocaleString("ru-RU")}</td><td><span className="pill">{scan.result}</span></td><td>{scan.ticket?.order.event.title??"—"}</td><td>{scan.ticket?.publicCode.slice(0,16)??"—"}</td></tr>)}</tbody></table></div></div></AdminShell>;
}
