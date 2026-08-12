"use client";

import { useMemo, useState } from "react";

export function CancellationReviewPrototype(){
  const orderAmount=400;
  const statutoryFee=Math.min(orderAmount*0.05,100);
  const [mode,setMode]=useState<"standard"|"full"|"custom">("standard");
  const [custom,setCustom]=useState(380);
  const refund=useMemo(()=>mode==="standard"?orderAmount-statutoryFee:mode==="full"?orderAmount:Math.max(0,Math.min(orderAmount,custom)),[mode,custom,statutoryFee]);
  const organizerCharge=Math.max(0,refund-(orderAmount-statutoryFee));

  return <div className="stack">
    <section className="panel stack">
      <div><span className="eyebrow">Рекомендация Atlas</span><h2 style={{marginBottom:6}}>Стандартный возврат: {refund.toFixed(0)} ₪</h2><p className="muted">Заказ 400 ₪. Расчётная комиссия отмены: 5% = {statutoryFee.toFixed(0)} ₪. Клиенту по стандартному сценарию предлагается вернуть {(orderAmount-statutoryFee).toFixed(0)} ₪.</p></div>
      <label className="panel" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer",borderColor:mode==="standard"?"#111827":undefined}}><input type="radio" checked={mode==="standard"} onChange={()=>setMode("standard")}/><div><strong>Вернуть {(orderAmount-statutoryFee).toFixed(0)} ₪</strong><div className="muted">Стандартный возврат. {statutoryFee.toFixed(0)} ₪ удерживаются из суммы клиента.</div></div></label>
      <label className="panel" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer",borderColor:mode==="full"?"#111827":undefined}}><input type="radio" checked={mode==="full"} onChange={()=>setMode("full")}/><div><strong>Вернуть полные {orderAmount} ₪</strong><div className="muted">Клиент получает всю сумму. Комиссию {statutoryFee.toFixed(0)} ₪ берёт на себя организатор.</div></div></label>
      <label className="panel" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer",borderColor:mode==="custom"?"#111827":undefined}}><input type="radio" checked={mode==="custom"} onChange={()=>setMode("custom")}/><div style={{flex:1}}><strong>Другая сумма</strong><div className="muted" style={{marginBottom:8}}>Для нестандартной или добровольной отмены.</div>{mode==="custom"&&<input className="input" type="number" min={0} max={orderAmount} value={custom} onChange={e=>setCustom(Number(e.target.value))}/>}</div></label>
    </section>

    <section className="panel stack">
      <div className="row between"><span className="muted">Сумма заказа</span><strong>{orderAmount} ₪</strong></div>
      <div className="row between"><span className="muted">Возврат клиенту</span><strong>{refund.toFixed(0)} ₪</strong></div>
      <div className="row between"><span className="muted">Удержание из клиента</span><strong>{Math.max(0,orderAmount-refund).toFixed(0)} ₪</strong></div>
      <div className="row between"><span className="muted">Доплата организатора Atlas</span><strong>{organizerCharge.toFixed(0)} ₪</strong></div>
      <hr style={{border:0,borderTop:"1px solid #e5e7eb"}}/>
      <div className="row" style={{gap:10,flexWrap:"wrap"}}><button className="btn dark" type="button" onClick={()=>alert(`Прототип: вернуть клиенту ${refund.toFixed(0)} ₪. Реальный HYP refund пока отключён.`)}>Одобрить отмену</button><button className="btn secondary" type="button" onClick={()=>alert("Прототип: заявка отклонена. Backend пока не подключён.")}>Отклонить</button></div>
    </section>
  </div>;
}
