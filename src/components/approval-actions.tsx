"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalActions({publicId,returnTo="/office/requests"}:{publicId:string;returnTo?:string}){
  const router=useRouter();const [note,setNote]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function review(action:"approve"|"reject",openNext=false){setBusy(true);setError("");const response=await fetch(`/api/admin/orders/${publicId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action,note})});const data=await response.json();if(!response.ok){setError(data.error||"Не удалось обработать заявку");setBusy(false);return;}router.push(openNext?`${returnTo}${returnTo.includes("?")?"&":"?"}focus=next`:returnTo);router.refresh();}
  return <div className="panel form"><div className="field"><label>Комментарий клиенту или внутренняя пометка</label><textarea value={note} onChange={event=>setNote(event.target.value)} rows={3}/></div>{error&&<div className="toast">{error}</div>}<div className="row" style={{flexWrap:"wrap"}}><button className="btn" disabled={busy} onClick={()=>void review("approve")}>Одобрить и вернуться</button><button className="btn secondary" disabled={busy} onClick={()=>void review("reject")}>Отклонить и вернуться</button><button className="btn secondary" disabled={busy} onClick={()=>void review("approve",true)}>Одобрить и открыть следующую</button></div></div>;
}
