import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const rows = [
  { id:"CAN-1042", order:"ATL-MSQ0S5XT-F6E2", customer:"Игорь Рубин", event:"BANDEROS", amount:"400 ₪", requested:"Сегодня, 17:36", status:"Новая", legal:"Подходит под стандартную отмену" },
  { id:"CAN-1038", order:"ATL-K2P7X4LM-A91B", customer:"Anna Levin", event:"Reflex", amount:"338 ₪", requested:"Сегодня, 15:12", status:"Ожидает решения", legal:"Подходит под стандартную отмену" },
  { id:"CAN-1027", order:"ATL-J8F3R1QP-D0C4", customer:"Michael Cohen", event:"Quest Pistols", amount:"169 ₪", requested:"Вчера, 20:41", status:"Требует проверки", legal:"Срок стандартной отмены истёк" },
];

export default async function CancellationsPage(){
  await requirePermission("ORDER_VIEW");
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Cancellation Center</span><h1>Отмены</h1><p>Заявки клиентов на отмену билетов и возврат средств.</p></div><Link className="btn secondary" href="/cancel-order" target="_blank">Клиентский экран</Link></div>
    <div className="stats">
      <div className="stat"><span className="muted">Новые</span><strong>1</strong><small>требуют решения</small></div>
      <div className="stat"><span className="muted">На рассмотрении</span><strong>2</strong><small>сегодня</small></div>
      <div className="stat"><span className="muted">Возвращено</span><strong>12,460 ₪</strong><small>за 30 дней</small></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Заявка</th><th>Клиент</th><th>Мероприятие</th><th>Сумма</th><th>Правило</th><th>Статус</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td><Link href={`/office/cancellations/${row.id}`}><strong>{row.id}</strong></Link><br/><small>{row.order}</small></td><td><strong>{row.customer}</strong><br/><small>{row.requested}</small></td><td>{row.event}</td><td><strong>{row.amount}</strong></td><td><span className="muted">{row.legal}</span></td><td><span className="pill">{row.status}</span></td></tr>)}
    </tbody></table></div>
    <div className="panel" style={{marginTop:18,background:"#f8fafc"}}><strong>Прототип</strong><p className="muted" style={{marginBottom:0}}>На этом этапе кнопки не выполняют реальный refund через HYP. Мы утверждаем интерфейс и бизнес-логику.</p></div>
  </AdminShell>;
}
