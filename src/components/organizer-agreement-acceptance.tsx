"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

const copy={
  ru:{confirm:"Сначала подтвердите, что ознакомились с условиями.",owner:"Принять договор может только владелец организации.",error:"Не удалось зафиксировать принятие договора.",saved:"Договор принят и сохранён",title:"Для этой организации ещё нет зафиксированного электронного договора.",help:"Откройте актуальную редакцию, ознакомьтесь с ней и подтвердите принятие. Atlas сохранит версию, текст, дату, подписанта и контрольный hash.",prefix:"Я ознакомился и принимаю",link:"условия Atlas One для организаторов",saving:"Сохраняем...",accept:"Принять договор"},
  he:{confirm:"יש לאשר שקראתם את התנאים לפני ההמשך.",owner:"רק בעל הארגון יכול לאשר את ההסכם.",error:"לא הצלחנו לתעד את אישור ההסכם.",saved:"ההסכם אושר ונשמר",title:"עדיין אין לארגון הזה הסכם דיגיטלי מתועד.",help:"פתחו את הנוסח העדכני, קראו אותו ואשרו את ההסכם. Atlas תשמור את הגרסה, הטקסט, התאריך, זהות המאשר וחתימת הבקרה.",prefix:"קראתי ואני מאשר/ת את",link:"תנאי Atlas One למפיקים",saving:"שומרים...",accept:"אישור ההסכם"},
  en:{confirm:"Confirm that you have reviewed the terms first.",owner:"Only the organization owner can accept the agreement.",error:"Could not record agreement acceptance.",saved:"Agreement accepted and saved",title:"This organization does not yet have a recorded electronic agreement.",help:"Open the current version, review it, and confirm acceptance. Atlas will store the version, text, date, signer, and verification hash.",prefix:"I have reviewed and accept the",link:"Atlas One organizer terms",saving:"Saving...",accept:"Accept agreement"}
} as const;

export function OrganizerAgreementAcceptance(){
  const {locale}=useLocale();const text=copy[locale];
  const router=useRouter();
  const [accepted,setAccepted]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function submit(){
    if(!accepted){setMessage(text.confirm);return;}
    setBusy(true);setMessage("");
    const response=await fetch("/api/organizer-agreement/accept",{method:"POST"});
    const body=await response.json().catch(()=>({}));setBusy(false);
    if(!response.ok){setMessage(body.error==="OWNER_ONLY"?text.owner:text.error);return;}
    setMessage(text.saved);router.refresh();
  }
  return <div className="platform-contract-card" style={{background:"#fffaf0",borderColor:"#f0dfb8"}}>
    <strong>{text.title}</strong><p className="muted" style={{margin:0}}>{text.help}</p>
    <label className="row" style={{alignItems:"flex-start"}}><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/><span>{text.prefix} <Link href="/legal/organizer-terms" target="_blank" style={{textDecoration:"underline"}}>{text.link}</Link>.</span></label>
    <div className="row"><button className="btn" type="button" disabled={busy} onClick={submit}>{busy?text.saving:text.accept}</button>{message&&<small className="muted">{message}</small>}</div>
  </div>;
}
