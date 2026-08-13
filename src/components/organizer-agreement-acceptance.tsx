"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizerAgreementAcceptance(){
  const router=useRouter();
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(){
    if(!accepted){setMessage("Сначала подтвердите, что ознакомились с условиями.");return;}
    setBusy(true);setMessage("");
    const response=await fetch("/api/organizer-agreement/accept",{method:"POST"});
    const body=await response.json().catch(()=>({}));
    setBusy(false);
    if(!response.ok){setMessage(body.error==="OWNER_ONLY"?"Принять договор может только владелец организации.":"Не удалось зафиксировать принятие договора.");return;}
    setMessage("Договор принят и сохранён");router.refresh();
  }
  return <div className="platform-contract-card" style={{background:"#fffaf0",borderColor:"#f0dfb8"}}>
    <strong>Для этой организации ещё нет зафиксированного электронного договора.</strong>
    <p className="muted" style={{margin:0}}>Откройте актуальную редакцию, ознакомьтесь с ней и подтвердите принятие. Atlas сохранит версию, текст, дату, подписанта и контрольный hash.</p>
    <label className="row" style={{alignItems:"flex-start"}}><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/><span>Я ознакомился и принимаю <Link href="/legal/organizer-terms" target="_blank" style={{textDecoration:"underline"}}>условия Atlas One для организаторов</Link>.</span></label>
    <div className="row"><button className="btn" type="button" disabled={busy} onClick={submit}>{busy?"Сохраняем...":"Принять договор"}</button>{message&&<small className="muted">{message}</small>}</div>
  </div>;
}
