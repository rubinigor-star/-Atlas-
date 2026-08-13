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
};
type CredentialStatus = {
  exists: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  locked: boolean;
  emailVerified: boolean;
};

export function PlatformOrganizerProfileForm({ organizationId, initial }: { organizationId: string; initial: Initial }) {
  const router = useRouter();
  const [form,setForm]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [securityBusy,setSecurityBusy]=useState(false);
  const [securityMessage,setSecurityMessage]=useState("");
  const [credentialStatus,setCredentialStatus]=useState<CredentialStatus|null>(null);
  const set=(key:keyof Initial,value:string)=>setForm(current=>({...current,[key]:value}));

  async function save(){
    setSaving(true);setMessage("");
    const response=await fetch(`/api/platform/organizers/${organizationId}/profile`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
    setSaving(false);
    if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.error==="EMAIL_EXISTS"?"Этот email уже используется другим аккаунтом.":"Не удалось сохранить данные.");return;}
    setMessage("Данные сохранены");router.refresh();
  }

  async function security(action:"STATUS"|"UNLOCK"|"SET_PASSWORD"){
    if(action==="SET_PASSWORD"&&newPassword.length<10){setSecurityMessage("Пароль должен содержать минимум 10 символов.");return;}
    setSecurityBusy(true);setSecurityMessage("");
    const response=await fetch(`/api/platform/organizers/${organizationId}/security`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(action==="SET_PASSWORD"?{action,password:newPassword}:{action})});
    const body=await response.json().catch(()=>({}));
    setSecurityBusy(false);
    if(!response.ok){setSecurityMessage(body.error||"Не удалось выполнить операцию.");return;}
    if(body.status)setCredentialStatus(body.status);
    if(action==="UNLOCK")setSecurityMessage(body.status?.locked?"Блокировка всё ещё активна. Обновите статус или проверьте другой аккаунт.":`Блокировка подтверждённо снята. Неудачных попыток: ${body.status?.failedAttempts ?? 0}.`);
    else if(action==="SET_PASSWORD"){setSecurityMessage(`Новый пароль установлен. Блокировка снята. Неудачных попыток: ${body.status?.failedAttempts ?? 0}.`);setNewPassword("");}
    else setSecurityMessage("Статус входа обновлён.");
  }

  return <>
    <section className="platform-section-card">
      <div><span className="eyebrow">Профиль организатора</span><h2>Контактные и юридические данные</h2><p className="muted">Эти данные можно исправлять отдельно от договора и документов для выплат.</p></div>
      <div className="form-grid two" style={{marginTop:18}}>
        <label className="field"><span>Название организации</span><input className="input" value={form.organizationName} onChange={e=>set("organizationName",e.target.value)}/></label>
        <label className="field"><span>Имя владельца</span><input className="input" value={form.ownerName} onChange={e=>set("ownerName",e.target.value)}/></label>
        <label className="field"><span>Email владельца</span><input className="input" type="email" value={form.ownerEmail} onChange={e=>set("ownerEmail",e.target.value)}/></label>
        <label className="field"><span>Телефон</span><input className="input" value={form.phone} onChange={e=>set("phone",e.target.value)}/></label>
        <label className="field"><span>Тип бизнеса</span><input className="input" value={form.businessType} onChange={e=>set("businessType",e.target.value)}/></label>
        <label className="field"><span>Страна</span><input className="input" value={form.country} onChange={e=>set("country",e.target.value)}/></label>
      </div>
      <div className="row" style={{marginTop:16}}><button className="btn" type="button" disabled={saving} onClick={save}>{saving?"Сохранение...":"Сохранить данные"}</button>{message&&<span className="muted">{message}</span>}</div>
    </section>

    <section className="platform-section-card">
      <div><span className="eyebrow">Доступ владельца</span><h2>Вход в кабинет</h2><p className="muted">Только для Superuser. Здесь показывается фактический статус OfficeCredential из базы после каждой операции.</p></div>
      <div className="form-grid two" style={{marginTop:18}}>
        <label className="field"><span>Аккаунт</span><input className="input" value={form.ownerEmail} disabled/></label>
        <label className="field"><span>Новый пароль</span><input className="input" type="password" minLength={10} autoComplete="new-password" placeholder="Минимум 10 символов" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
      </div>
      {credentialStatus&&<div className="stats" style={{marginTop:16,marginBottom:0}}>
        <div className="stat"><span className="muted">Credential</span><strong style={{fontSize:18}}>{credentialStatus.exists?"Есть":"Нет"}</strong></div>
        <div className="stat"><span className="muted">Блокировка</span><strong style={{fontSize:18,color:credentialStatus.locked?"#b42318":"#15803d"}}>{credentialStatus.locked?"Заблокирован":"Не заблокирован"}</strong></div>
        <div className="stat"><span className="muted">Неудачных попыток</span><strong style={{fontSize:18}}>{credentialStatus.failedAttempts}</strong></div>
        <div className="stat"><span className="muted">Email</span><strong style={{fontSize:18}}>{credentialStatus.emailVerified?"Подтверждён":"Не подтверждён"}</strong></div>
      </div>}
      <div className="row" style={{marginTop:16,flexWrap:"wrap"}}><button className="btn secondary" type="button" disabled={securityBusy} onClick={()=>security("STATUS")}>Проверить статус</button><button className="btn secondary" type="button" disabled={securityBusy} onClick={()=>security("UNLOCK")}>Снять блокировку входа</button><button className="btn" type="button" disabled={securityBusy||newPassword.length<10} onClick={()=>security("SET_PASSWORD")}>Установить новый пароль</button>{credentialStatus&&!credentialStatus.locked&&<a className="btn secondary" href="/office/login" target="_blank" rel="noreferrer">Открыть чистую страницу входа</a>}{securityMessage&&<span className="muted">{securityMessage}</span>}</div>
    </section>
  </>;
}
