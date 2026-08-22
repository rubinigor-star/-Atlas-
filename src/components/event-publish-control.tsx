"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

const copy={
 ru:{eyebrow:"Запуск мероприятия",draftTitle:"Готово к публикации?",publishedTitle:"Мероприятие опубликовано",draftHelp:"После публикации публичная страница станет доступна покупателям и можно будет принимать заказы.",publishedHelp:"Публичная страница доступна покупателям. При необходимости мероприятие можно временно вернуть в черновики.",busy:"Сохраняем…",publish:"Опубликовать мероприятие",unpublish:"Вернуть в черновики",published:"Мероприятие опубликовано",drafted:"Мероприятие возвращено в черновики",error:"Не удалось изменить статус мероприятия"},
 he:{eyebrow:"השקת האירוע",draftTitle:"מוכנים לפרסום?",publishedTitle:"האירוע פורסם",draftHelp:"לאחר הפרסום עמוד האירוע יהיה זמין לרוכשים ויהיה אפשר לקבל הזמנות.",publishedHelp:"עמוד האירוע זמין לרוכשים. במידת הצורך אפשר להחזיר את האירוע זמנית לטיוטה.",busy:"שומרים…",publish:"פרסום האירוע",unpublish:"החזרה לטיוטה",published:"האירוע פורסם",drafted:"האירוע הוחזר לטיוטה",error:"לא הצלחנו לשנות את סטטוס האירוע"},
 en:{eyebrow:"Event launch",draftTitle:"Ready to publish?",publishedTitle:"Event is published",draftHelp:"After publishing, the public event page becomes available to buyers and orders can be accepted.",publishedHelp:"The public event page is available to buyers. You can temporarily return the event to draft if needed.",busy:"Saving…",publish:"Publish event",unpublish:"Return to draft",published:"Event published",drafted:"Event returned to draft",error:"Could not change event status"}
} as const;

export function EventPublishControl({eventId,status}:{eventId:string;status:"DRAFT"|"PUBLISHED"}){
 const router=useRouter();const{locale}=useLocale();const text=copy[locale];const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
 async function change(next:"DRAFT"|"PUBLISHED"){setBusy(true);setMessage("");try{const response=await fetch(`/api/admin/events/${eventId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"status",status:next})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||text.error);setMessage(next==="PUBLISHED"?text.published:text.drafted);router.refresh();}catch(error){setMessage(error instanceof Error?error.message:text.error);}finally{setBusy(false)}}
 return <section className="panel stack"><div><span className="eyebrow">{text.eyebrow}</span><h2>{status==="DRAFT"?text.draftTitle:text.publishedTitle}</h2><p className="muted">{status==="DRAFT"?text.draftHelp:text.publishedHelp}</p></div><div className="row"><button type="button" className={status==="DRAFT"?"btn dark":"btn secondary"} disabled={busy} onClick={()=>void change(status==="DRAFT"?"PUBLISHED":"DRAFT")}>{busy?text.busy:status==="DRAFT"?text.publish:text.unpublish}</button>{message&&<span className="muted" role="status">{message}</span>}</div></section>;
}
