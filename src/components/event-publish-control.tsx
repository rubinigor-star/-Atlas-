"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EventPublishControl({eventId,status}:{eventId:string;status:"DRAFT"|"PUBLISHED"}){
 const router=useRouter();
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 async function change(next:"DRAFT"|"PUBLISHED"){
  setBusy(true);setMessage("");
  try{
   const response=await fetch(`/api/admin/events/${eventId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"status",status:next})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Не удалось изменить статус мероприятия");
   setMessage(next==="PUBLISHED"?"Мероприятие опубликовано":"Мероприятие возвращено в черновики");
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"Не удалось изменить статус мероприятия");}
  finally{setBusy(false)}
 }
 return <section className="panel stack"><div><span className="eyebrow">Запуск мероприятия</span><h2>{status==="DRAFT"?"Готово к публикации?":"Мероприятие опубликовано"}</h2><p className="muted">{status==="DRAFT"?"После публикации публичная страница станет доступна покупателям и можно будет принимать заказы.":"Публичная страница доступна покупателям. При необходимости мероприятие можно временно вернуть в черновики."}</p></div><div className="row"><button type="button" className={status==="DRAFT"?"btn dark":"btn secondary"} disabled={busy} onClick={()=>void change(status==="DRAFT"?"PUBLISHED":"DRAFT")}>{busy?"Сохраняем…":status==="DRAFT"?"Опубликовать мероприятие":"Вернуть в черновики"}</button>{message&&<span className="muted" role="status">{message}</span>}</div></section>;
}
