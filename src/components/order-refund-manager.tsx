"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode="CANCELLATION"|"TECHNICAL_PARTIAL";
type FeePayer="CUSTOMER"|"ORGANIZER";

export function OrderRefundManager({orderId,totalMinor,alreadyRefunded}:{orderId:string;totalMinor:number;alreadyRefunded:boolean}){
 const router=useRouter();
 const feeMinor=Math.min(Math.round(totalMinor*0.05),10000);
 const[mode,setMode]=useState<Mode>("CANCELLATION");
 const[feePayer,setFeePayer]=useState<FeePayer>("CUSTOMER");
 const[amount,setAmount]=useState("");
 const[reason,setReason]=useState("");
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const cancellationRefundMinor=feePayer==="CUSTOMER"?Math.max(0,totalMinor-feeMinor):totalMinor;

 async function refund(){
  if(reason.trim().length<3){setMessage("Укажите причину возврата");return;}
  let amountMinor:number|undefined;
  if(mode==="TECHNICAL_PARTIAL"){
   amountMinor=Math.round(Number(amount)*100);
   if(!amountMinor||amountMinor<1){setMessage("Укажите сумму частичного возврата");return;}
   if(amountMinor>=totalMinor){setMessage("Полный возврат оформляется только как отмена заказа");return;}
  }
  const text=mode==="CANCELLATION"
   ?`Отменить заказ и вернуть клиенту ${(cancellationRefundMinor/100).toFixed(2)} ₪? Комиссия отмены ${(feeMinor/100).toFixed(2)} ₪.`
   :`Сделать технический частичный возврат ${((amountMinor||0)/100).toFixed(2)} ₪? Билеты останутся действительными.`;
  if(!window.confirm(text))return;
  setBusy(true);setMessage("");
  try{
   const response=await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mode,amountMinor,reason:reason.trim(),cancellationFeePayer:mode==="CANCELLATION"?feePayer:undefined})});
   const data=await response.json().catch(()=>({error:"Некорректный ответ сервера"}));
   if(!response.ok)throw new Error(data.error||"Возврат не выполнен");
   setMessage(`✓ Возврат ${(data.amountMinor/100).toFixed(2)} ₪ подтверждён HYP${data.orderCancelled?". Заказ отменён.":"."}`);
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"Ошибка возврата");}finally{setBusy(false);}
 }

 return <section className="panel form">
  <span className="eyebrow">Финансы</span><h2>Возврат средств</h2>
  <p className="muted">Одна и та же серверная логика применяется в кабинете и мобильном приложении. Отмена заказа всегда учитывает комиссию 5%, максимум 100 ₪.</p>
  {alreadyRefunded?<div className="toast">По этому заказу возврат уже зарегистрирован.</div>:<>
   <div className="field"><label>Тип операции</label><select className="input" value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="CANCELLATION">Отмена заказа</option><option value="TECHNICAL_PARTIAL">Технический частичный возврат</option></select></div>
   {mode==="CANCELLATION"?<div className="panel form">
    <strong>Комиссия отмены: {(feeMinor/100).toFixed(2)} ₪</strong>
    <label><input type="radio" checked={feePayer==="CUSTOMER"} onChange={()=>setFeePayer("CUSTOMER")}/> Клиент оплачивает 5% - вернуть {(Math.max(0,totalMinor-feeMinor)/100).toFixed(2)} ₪</label>
    <label><input type="radio" checked={feePayer==="ORGANIZER"} onChange={()=>setFeePayer("ORGANIZER")}/> Организатор оплачивает 5% - вернуть клиенту {(totalMinor/100).toFixed(2)} ₪</label>
   </div>:<div className="field"><label>Сумма частичного возврата, ₪</label><input className="input" type="number" min="0.01" max={Math.max(0,(totalMinor-1)/100).toFixed(2)} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/><span className="muted">Билет и заказ остаются активными. Для отмены используйте режим «Отмена заказа».</span></div>}
   <div className="field"><label>Причина</label><input className="input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Например: запрос клиента"/></div>
   <button type="button" className="btn" onClick={()=>void refund()} disabled={busy}>{busy?"Отправляем возврат…":mode==="CANCELLATION"?"Отменить и вернуть через HYP":"Вернуть через HYP"}</button>
  </>}
  {message&&<div className="toast">{message}</div>}
 </section>;
}
