import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { CancellationReviewPrototype } from "@/components/cancellation-review-prototype";

export const dynamic = "force-dynamic";

export default async function CancellationDetail({params}:{params:Promise<{id:string}>}){
  await requirePermission("ORDER_VIEW");
  const {id}=await params;
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Cancellation request</span><h1>{id}</h1><p>Проверка заявки и выбор суммы возврата.</p></div><Link className="btn secondary" href="/office/cancellations">Назад к отменам</Link></div>
    <div className="form-grid two" style={{alignItems:"start"}}>
      <div className="stack">
        <section className="panel stack"><div><span className="eyebrow">Клиент и заказ</span><h2>Игорь Рубин</h2></div><div className="row between"><span className="muted">Номер заказа</span><strong>ATL-MSQ0S5XT-F6E2</strong></div><div className="row between"><span className="muted">Email</span><strong>rubin.igor@gmail.com</strong></div><div className="row between"><span className="muted">Телефон</span><strong>+972 54 729 9727</strong></div><div className="row between"><span className="muted">Дата покупки</span><strong>12.08.2026</strong></div><div className="row between"><span className="muted">Заявка на отмену</span><strong>12.08.2026, 17:36</strong></div></section>
        <section className="panel stack"><div><span className="eyebrow">Мероприятие</span><h2>BANDEROS</h2></div><div className="row between"><span className="muted">Дата</span><strong>31.10.2026</strong></div><div className="row between"><span className="muted">Билеты</span><strong>2 × Regular</strong></div><div className="row between"><span className="muted">Сумма заказа</span><strong>400 ₪</strong></div></section>
        <section className="panel" style={{background:"#f0fdf4",borderColor:"#bbf7d0"}}><span className="eyebrow">Проверка правил</span><h3 style={{marginTop:6}}>Подходит под стандартную отмену</h3><p className="muted" style={{marginBottom:0}}>Прототип Atlas: покупка находится в допустимом окне отмены, до мероприятия достаточно времени. Финальную юридическую формулу мы закрепим перед backend-реализацией.</p></section>
      </div>
      <CancellationReviewPrototype/>
    </div>
  </AdminShell>;
}
