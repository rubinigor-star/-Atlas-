"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DocumentState = {
  provided: boolean;
  name: string | null;
  updatedAt: string | null;
};

export function OrganizerDocumentsForm({
  organizationId,
  bank,
  tax,
}: {
  organizationId: string;
  bank: DocumentState;
  tax: DocumentState;
}) {
  const router = useRouter();
  const bankRef = useRef<HTMLInputElement>(null);
  const taxRef = useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState<"bank"|"tax"|null>(null);
  const [message,setMessage]=useState("");

  async function upload(kind:"bank"|"tax",file:File|null){
    if(!file)return;
    setBusy(kind);setMessage("");
    const body=new FormData();body.set("kind",kind);body.set("file",file);
    const response=await fetch(`/api/organizer-documents/${organizationId}`,{method:"POST",body});
    const data=await response.json().catch(()=>({}));
    setBusy(null);
    if(!response.ok){
      setMessage(data.error==="BLOB_NOT_CONFIGURED"?"Хранилище документов ещё не подключено в Vercel.":data.error==="FILE_TOO_LARGE"?"Файл слишком большой. Максимум 4 МБ.":"Не удалось загрузить документ.");
      return;
    }
    setMessage("Документ сохранён");
    if(kind==="bank"&&bankRef.current)bankRef.current.value="";
    if(kind==="tax"&&taxRef.current)taxRef.current.value="";
    router.refresh();
  }

  function card(kind:"bank"|"tax",title:string,state:DocumentState,ref:React.RefObject<HTMLInputElement|null>){
    return <div className="platform-document-card">
      <div><span className={`platform-document-status ${state.provided?"ready":"missing"}`}>{state.provided?"✓ Загружен":"Требуется"}</span><h3>{title}</h3>{state.name?<p><strong>{state.name}</strong>{state.updatedAt&&<><br/><small className="muted">Обновлён {state.updatedAt}</small></>}</p>:<p className="muted">PDF, JPG или PNG. Документ хранится приватно и доступен только авторизованному организатору и Atlas.</p>}</div>
      <div className="row" style={{flexWrap:"wrap"}}>
        <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy!==null} onChange={event=>upload(kind,event.target.files?.[0]??null)} style={{maxWidth:280}}/>
        {state.provided&&<a className="btn secondary" href={`/api/organizer-documents/${organizationId}/${kind}`}>Скачать</a>}
      </div>
      {busy===kind&&<small className="muted">Загрузка...</small>}
    </div>;
  }

  return <section className="platform-section-card">
    <div><span className="eyebrow">Документы для выплат</span><h2>Банк и налогообложение</h2><p className="muted">Эти документы не блокируют регистрацию. Они обязательны только до первой выплаты.</p></div>
    <div className="platform-documents-grid">{card("bank","Банковские реквизиты / אישור ניהול חשבון",bank,bankRef)}{card("tax","ניכוי מס במקור / налоговый документ",tax,taxRef)}</div>
    {message&&<div className="toast" style={{marginTop:14}}>{message}</div>}
  </section>;
}
