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
type OrganizerUser = { id:string; name:string|null; email:string; staffRole:string|null; role:string; active:boolean };
type CredentialStatus = {
  exists: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  locked: boolean;
  emailVerified: boolean;
};

export function PlatformOrganizerProfileForm({ organizationId, initial, users }: { organizationId: string; initial: Initial; users: OrganizerUser[] }) {
  const router = useRouter();
  const [form,setForm]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [securityBusy,setSecurityBusy]=useState(false);
  const [securityMessage,setSecurityMessage]=useState("");
  const [credentialStatus,setCredentialStatus]=useState<CredentialStatus|null>(null);
  const ownerUser=users.find(user=>user.staffRole==="OWNER")??users[0];
  const [selectedUserId,setSelectedUserId]=useState(ownerUser?.id??"");
  const selectedUser=users.find(user=>user.id===selectedUserId)??ownerUser;
  const set=(key:keyof Initial,value:string)=>setForm(current=>({...current,[key]:value}));

  async function save(){
    setSaving(true);setMessage("");
    const response=await fetch(`/api/platform/organizers/${organizationId}/profile`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
    setSaving(false);
    if(!response.ok){const body=await response.json().catch(()=>({}));setMessage(body.error==="EMAIL_EXISTS"?"Этот email уже используется другим аккаунтом.":"Не удалось сохранить данные.");return;}
    setMessage("Данные сохранены");router.refresh();
  }

  async function security(action:"STATUS"|"UNLOCK"|"SET_PASSWORD"){
    if(!selectedUserId){setSecurityMessage("Сначала выберите пользователя.");return;}
    if(action==="SET_PASSWORD"&&newPassword.length<10){setSecurityMessage("Пароль должен содержать минимум 10 символов.");return;}
    setSecurityBusy(true);setSecurityMessage("");
    const payload=action==="SET_PASSWORD"?{action,userId:selectedUserId,password:newPassword}:{action,userId:selectedUserId};
    const response=await fetch(`/api/platform/organizers/${organizationId}/security`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const body=await response.json().catch(()=>({}));
    setSecurityBusy(false);
    if(!response.ok){setSecurityMessage(body.error||"Не удалось выполнить операцию.");return;}
    if(body.status)setCredentialStatus(body.status);
    if(action==="UNLOCK")setSecurityMessage(body.status?.locked?"Блокировка всё ещё активна.":`Аккаунт ${body.email} разблокирован. Неудачных попыток: ${body.status?.failedAttempts ?? 0}.`);
    else if(action==="SET_PASSWORD"){setSecurityMessage(`Новый пароль для ${body.email} установлен. Блокировка снята.`);setNewPassword("");}
    else setSecurityMessage(`Статус ${body.email} обновлён.`);
  }

  function chooseUser(userId:string){setSelectedUserId(userId);setCredentialStatus(null);setSecurityMessage("");setNewPassword("");}

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
      <div><span className="eyebrow">Пользователи организации</span><h2>Доступ в кабинет</h2><p className="muted">Superuser управляет каждым аккаунтом отдельно. Выберите конкретного пользователя, чтобы проверить статус, снять блокировку или установить новый пароль.</p></div>
      <div className="table-wrap" style={{marginTop:18}}><table><thead><tr><th>Пользователь</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.name||"Без имени"}</strong></td><td>{user.email}</td><td>{user.staffRole||user.role}</td><td>{user.active?"Активен":"Отключён"}</td><td><button className="btn secondary" type="button" onClick={()=>chooseUser(user.id)}>{selectedUserId===user.id?"Выбран":"Управлять"}</button></td></tr>)}</tbody></table></div>
      {selectedUser&&<div style={{marginTop:20,paddingTop:18,borderTop:"1px solid #e5e7eb"}}>
        <div className="form-grid two">
          <label className="field"><span>Выбранный аккаунт</span><input className="input" value={`${selectedUser.name||"Без имени"} · ${selectedUser.email}`} disabled/></label>
          <label className="field"><span>Новый пароль</span><input className="input" type="password" minLength={10} autoComplete="new-password" placeholder="Минимум 10 символов" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
        </div>
        {credentialStatus&&<div className="stats" style={{marginTop:16,marginBottom:0}}>
          <div className="stat"><span className="muted">Credential</span><strong style={{fontSize:18}}>{credentialStatus.exists?"Есть":"Нет"}</strong></div>
          <div className="stat"><span className="muted">Блокировка</span><strong style={{fontSize:18,color:credentialStatus.locked?"#b42318":"#15803d"}}>{credentialStatus.locked?"Заблокирован":"Не заблокирован"}</strong></div>
          <div className="stat"><span className="muted">Неудачных попыток</span><strong style={{fontSize:18}}>{credentialStatus.failedAttempts}</strong></div>
          <div className="stat"><span className="muted">Email</span><strong style={{fontSize:18}}>{credentialStatus.emailVerified?"Подтверждён":"Не подтверждён"}</strong></div>
        </div>}
        <div className="row" style={{marginTop:16,flexWrap:"wrap"}}><button className="btn secondary" type="button" disabled={securityBusy} onClick={()=>security("STATUS")}>Проверить статус</button><button className="btn secondary" type="button" disabled={securityBusy} onClick={()=>security("UNLOCK")}>Снять блокировку</button><button className="btn" type="button" disabled={securityBusy||newPassword.length<10} onClick={()=>security("SET_PASSWORD")}>Установить новый пароль</button>{credentialStatus&&!credentialStatus.locked&&<a className="btn secondary" href="/office/login" target="_blank" rel="noreferrer">Открыть чистый вход</a>}{securityMessage&&<span className="muted">{securityMessage}</span>}</div>
      </div>}
    </section>
  </>;
}
