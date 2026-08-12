"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function CancellationReviewPrototype({id,orderAmountMinor,statutoryFeeMinor,status}:{id:string;orderAmountMinor:number;statutoryFeeMinor:number;status:string}){
  const router=useRouter();
  const orderAmount=orderAmountMinor/100;
  const statutoryFee=statutoryFeeMinor/100;
  const [mode,setMode]=useState<"standard"|"full"|"custom">("standard");
  const [custom,setCustom]=useState(Math.max(0,orderAmount-statutoryFee));
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const refund=useMemo(()=>mode==="standard"?orderAmount-statutoryFee:mode==="full"?orderAmount:Math.max(0,Math.min(orderAmount,custom)),[mode,custom,orderAmount,statutoryFee]);
  const organizerCharge=Math.max(0,refund-(orderAmount-statutoryFee));
  const locked=status!=="NEW";

  async function decide(action:"APPROVE"|"REJECT"){
    setBusy(true);setMessage("");
    try{
      const response=await fetch(`/api/office/cancellations/${id}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,refundAmountMinor:Math.round(refund*100),note})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"Не удалось сохранить решение");
      setMessage(action==="APPROVE"?"Решение сохранено. Возврат поставлен в очередь исполнения.":"Заявка отклонена.");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Не удалось сохранить решение");}
    finally{setBusy(false);}
  }

  return <div className="stack">
    <section className="panel stack">
      <div><span className="eyebrow">Решение организатора</span><h2 style={{marginBottom:6}}>Выберите сумму возврата</h2><p className="muted">Atlas считает стандартное удержание как 5% стоимости заказа или 100 ₪, что меньше.</p></div>
      <label className="panel" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:locked?"default":"pointer",borderColor:mode==="standard"?"#111827":undefined}}><input disabled={locked} type="radio" checked={mode==="standard"} onChange={()=>setMode("standard")}/><div><strong>Вернуть {(orderAmount-statutoryFee).toFixed(2)} ₪</strong><div className="muted">Стандартный сценарий. {statutoryFee.toFixed(2)} ₪ удерживаются из суммы клиента.</div></div></label>
      <label className="panel" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:locked?"default":"pointer",borderColor:mode==="full"?"#111827":undefined}}><input disabled={locked} type="radio" checked={mode==="full"} onChange={()=>setMode("full")}/><div><strong>Вернуть полные {orderAmount.toFixed(2)} ₪</strong><div className="muted">Клиент получает всю сумму. Комиссию {statutoryFee.toFixed(2)} ₪ берёт на себя организатор.</div></div></label>
      <label className="panel" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:locked?"default":"pointer",borderColor:mode==="custom"?"#111827":undefined}}><input disabled={locked} type="radio" checked={mode==="custom"} onChange={()=>setMode("custom")}/><div style={{flex:1}}><strong>Другая сумма</strong><div className="muted" style={{marginBottom:8}}>Для добровольного или частичного возврата.</div>{mode==="custom"&&<input disabled={locked} className="input" type="number" min={0} max={orderAmount} step="0.01" value={custom} onChange={e=>setCustom(Number(e.target.value))}/>}</div></label>
      <div className="field"><label>Комментарий к решению, необязательно</label><textarea disabled={locked} rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Комментарий клиенту или внутреннее пояснение"/></div>
    </section>
    <section className="panel stack">
      <div className="row between"><span className="muted">Сумма заказа</span><strong>{orderAmount.toFixed(2)} ₪</strong></div>
      <div className="row between"><span className="muted">Возврат клиенту</span><strong>{refund.toFixed(2)} ₪</strong></div>
      <div className="row between"><span className="muted">Удержание из клиента</span><strong>{Math.max(0,orderAmount-refund).toFixed(2)} ₪</strong></div>
      <div className="row between"><span className="muted">Комиссия за счёт организатора</span><strong>{organizerCharge.toFixed(2)} ₪</strong></div>
      <hr style={{border:0,borderTop:"1px solid #e5e7eb"}}/>
      {locked?<div className="toast">По этой заявке решение уже принято. Текущий статус: {status}.</div>:<div className="row" style={{gap:10,flexWrap:"wrap"}}><button className="btn dark" disabled={busy} type="button" onClick={()=>void decide("APPROVE")}>{busy?"Сохраняем...":"Одобрить отмену"}</button><button className="btn secondary" disabled={busy} type="button" onClick={()=>void decide("REJECT")}>Отклонить</button></div>}
      {message&&<div className="toast">{message}</div>}
      <p className="muted" style={{fontSize:12,marginBottom:0}}>На этом этапе решение записывается в базу. Реальный HYP refund будет подключён отдельным безопасным шагом, чтобы Atlas не отмечал деньги возвращёнными до подтверждения платёжного провайдера.</p>
    </section>
  </div>;
}
