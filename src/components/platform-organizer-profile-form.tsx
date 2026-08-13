"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  country: string;
  phone: string;
  bankAccountLabel: string;
  taxDocumentLabel: string;
};

export function PlatformOrganizerProfileForm({ organizationId, initial }: { organizationId: string; initial: Initial }) {
  const router = useRouter();
  const [form,setForm]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const set=(key:keyof Initial,value:string)=>setForm(current=>({...current,[key]:value}));
  async function save(){
    setSaving(true);setMessage("");
    const response=await fetch(`/api/platform/organizers/${organizationId}/profile`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
    setSaving(false);
    if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.error==="EMAIL_EXISTS"?"Этот email уже используется другим аккаунтом.":"Не удалось сохранить данные.");return;}
    setMessage("Данные сохранены");router.refresh();
  }
  return <section className="platform-section-card">
    <div><span className="eyebrow">Профиль и выплаты</span><h2>Данные организатора</h2><p className="muted">Регистрация не блокируется из-за банковских или налоговых документов, но без них Atlas не разрешает финальную выплату.</p></div>
    <div className="form-grid two" style={{marginTop:18}}>
      <label className="field"><span>Название организации</span><input className="input" value={form.organizationName} onChange={e=>set("organizationName",e.target.value)}/></label>
      <label className="field"><span>Имя владельца</span><input className="input" value={form.ownerName} onChange={e=>set("ownerName",e.target.value)}/></label>
      <label className="field"><span>Email владельца</span><input className="input" type="email" value={form.ownerEmail} onChange={e=>set("ownerEmail",e.target.value)}/></label>
      <label className="field"><span>Телефон</span><input className="input" value={form.phone} onChange={e=>set("phone",e.target.value)}/></label>
      <label className="field"><span>Тип бизнеса</span><input className="input" value={form.businessType} onChange={e=>set("businessType",e.target.value)}/></label>
      <label className="field"><span>Страна</span><input className="input" value={form.country} onChange={e=>set("country",e.target.value)}/></label>
      <label className="field"><span>Банковские реквизиты / подтверждение</span><input className="input" placeholder="Например: Bank Leumi · account ending 1234" value={form.bankAccountLabel} onChange={e=>set("bankAccountLabel",e.target.value)}/><small className="muted">На этом этапе храним безопасное описание/подтверждение, а не номер карты.</small></label>
      <label className="field"><span>ניכוי מס במקור / налоговый документ</span><input className="input" placeholder="Название или ссылка/референс документа" value={form.taxDocumentLabel} onChange={e=>set("taxDocumentLabel",e.target.value)}/><small className="muted">Документ требуется для готовности к выплате.</small></label>
    </div>
    <div className="row" style={{marginTop:16}}><button className="btn" type="button" disabled={saving} onClick={save}>{saving?"Сохранение...":"Сохранить данные"}</button>{message&&<span className="muted">{message}</span>}</div>
  </section>;
}
