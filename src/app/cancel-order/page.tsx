import Link from "next/link";

export default function CancelOrderPage(){
  return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 20px 72px"}}>
    <div className="stack">
      <div><span className="eyebrow">Atlas One</span><h1>Отмена заказа</h1><p className="muted">Подайте заявку на отмену билетов. После проверки организатором вы получите решение и сумму возврата.</p></div>
      <section className="panel stack">
        <div className="field"><label>Номер заказа</label><input className="input" defaultValue="ATL-MSQ0S5XT-F6E2"/></div>
        <div className="field"><label>Email, использованный при покупке</label><input className="input" type="email" defaultValue="rubin.igor@gmail.com"/></div>
        <button className="btn dark" type="button">Найти заказ</button>
      </section>
      <section className="panel stack">
        <div><span className="eyebrow">Найден заказ</span><h2>BANDEROS</h2><p className="muted">31.10.2026 · 2 билета · 400 ₪</p></div>
        <div className="panel" style={{background:"#f8fafc"}}><strong>Предварительный расчёт</strong><p className="muted" style={{marginBottom:0}}>По стандартной политике Atlas ориентировочный возврат составит 380 ₪. Окончательная сумма подтверждается после рассмотрения заявки.</p></div>
        <label style={{display:"flex",gap:10,alignItems:"flex-start"}}><input type="checkbox" defaultChecked/><span>Я ознакомился с <Link href="/cancellation-policy">правилами отмены</Link> и хочу отправить заявку организатору.</span></label>
        <div className="field"><label>Комментарий для организатора, необязательно</label><textarea rows={4} placeholder="Например: не смогу посетить мероприятие"/></div>
        <button className="btn dark" type="button">Отправить заявку на отмену</button>
      </section>
      <p className="muted" style={{fontSize:13}}>Прототип: заявка пока не записывается в базу и деньги автоматически не возвращаются.</p>
    </div>
  </main>;
}
