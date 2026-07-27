"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderRefundManager({orderId,totalMinor,alreadyRefunded}:{orderId:string;totalMinor:number;alreadyRefunded:boolean}){
 const router=useRouter();const[amount,setAmount]=useState((totalMinor/100).toFixed(2));const[reason,setReason]=useState("");const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
 async function refund(){
  const amountMinor=Math.round(Number(amount)*100);if(!amountMinor||amountMinor<1){setMessage("Укажите сумму возврата");return;}if(amountMinor>totalMinor){setMessage("Сумма превышает сумму заказа");return;}if(reason.trim().length<3){setMessage("Укажите причину возврата");return;}
  const full=amountMinor===totalMinor;if(!window.confirm(`${full?"Полностью вернуть":"Вернуть"} ${(amountMinor/100).toFixed(2)} ₪? ${full?"Все билеты заказа будут аннулированы.":"Билеты останутся действительными."}`))return;
  setBusy(true);setMessage("");try{const response=await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({amountMinor,reason:reason.trim()})});const data=await response.json().catch(()=>({error:"Некорректный ответ сервера"}));if(!response.ok)throw new Error(data.error||"Возврат не выполнен");setMessage(`✓ Возврат ${(data.amountMinor/100).toFixed(2)} ₪ подтверждён HYP`);router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"Ошибка возврата");}finally{setBusy(false);}
 }
 return <section className="panel form"><span className="eyebrow">Финансы</span><h2>Возврат средств</h2><p className="muted">Возврат отправляется непосредственно в HYP на ту же карту. Полный возврат аннулирует билеты и освобождает места.</p>{alreadyRefunded?<div className="toast">По этому заказу возврат уже зарегистрирован.</div>:<><div className="form-grid two"><div className="field"><label>Сумма возврата, ₪</label><input className="input" type="number" min="0.01" max={(totalMinor/100).toFixed(2)} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="field"><label>Причина</label><input className="input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Например: мероприятие отменено"/></div></div><button type="button" className="btn" onClick={()=>void refund()} disabled={busy}>{busy?"Отправляем возврат…":"Вернуть через HYP"}</button></>}{message&&<div className="toast">{message}</div>}</section>;
}
