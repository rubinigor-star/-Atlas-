"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdmissionModeManager({eventId,initialMapEnabled}:{eventId:string;initialMapEnabled:boolean}){
  const router=useRouter();
  const[value,setValue]=useState(initialMapEnabled);
  const[busy,setBusy]=useState(false);

  async function choose(next:boolean){
    setValue(next);
    setBusy(true);
    const response=await fetch(`/api/admin/events/${eventId}`,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"admission",mapEnabled:next})
    });

    if(!response.ok){
      setBusy(false);
      setValue(!next);
      return;
    }

    if(next){
      await fetch(`/api/admin/events/${eventId}/ensure-reading-map`,{method:"POST"}).catch(()=>null);
    }

    setBusy(false);
    router.refresh();
  }

  return <section className="panel form"><span className="eyebrow">Формат продажи</span><h2>Как покупатель выбирает билет?</h2><div className="choice-grid"><button type="button" disabled={busy} className={`choice-card ${!value?"selected":""}`} onClick={()=>void choose(false)}><strong>Без схемы зала</strong><small>Покупатель выбирает тип и количество билетов.</small></button><button type="button" disabled={busy} className={`choice-card ${value?"selected":""}`} onClick={()=>void choose(true)}><strong>С выбором мест</strong><small>Карта, столы, диваны, ряды и назначение билетов открываются ниже в этой вкладке.</small></button></div></section>;
}
