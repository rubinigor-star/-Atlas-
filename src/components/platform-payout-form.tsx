"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlatformPayoutForm({eventId,availableMinor}:{eventId:string;availableMinor:number}){
  const router=useRouter();
  const [amount,setAmount]=useState((availableMinor/100).toFixed(2));
  const [reference,setReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  async function submit(){
    const amountMinor=Math.round(Number(amount)*100);
    if(!Number.isFinite(amountMinor)||amountMinor<=0){setMessage("Укажите корректную сумму");return;}
    if(amountMinor>availableMinor){setMessage(`Максимум ${(availableMinor/100).toFixed(2)} ₪`);return;}
    if(!window.confirm(`Зафиксировать уже выполненную выплату ${(amountMinor/100).toFixed(2)} ₪? Это действие не отправляет деньги, а только записывает банковский перевод в Atlas.`))return;
    setBusy(true);setMessage(null);
    try{
      const response=await fetch("/api/platform/finance/payouts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,amountMinor,reference})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Ошибка записи выплаты");
      setMessage("Выплата зафиксирована");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Ошибка записи выплаты");}
    finally{setBusy(false);}
  }

  return <div style={{display:"grid",gap:6,minWidth:210}}>
    <div style={{display:"flex",gap:6}}>
      <input aria-label="Сумма выплаты" value={amount} onChange={event=>setAmount(event.target.value)} inputMode="decimal" style={{width:95}}/>
      <span style={{alignSelf:"center"}}>₪</span>
      <button type="button" className="btn" onClick={submit} disabled={busy}>{busy?"Сохраняем...":"Зафиксировать"}</button>
    </div>
    <input aria-label="Номер банковского перевода" placeholder="№ перевода / примечание" value={reference} onChange={event=>setReference(event.target.value)}/>
    {message&&<small>{message}</small>}
  </div>;
}
