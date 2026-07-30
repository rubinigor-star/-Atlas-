"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Campaign={id:string;name:string;channel:"EMAIL"|"SMS"|"WHATSAPP";status:string;estimatedRecipients:number;estimatedCostMinor:number;createdAt:string;message:string};

const labels:Record<string,string>={DRAFT:"Черновик",SCHEDULED:"Запланирована",SENDING:"Отправляется",COMPLETED:"Завершена",FAILED:"Ошибка",CANCELLED:"Отменена",ARCHIVED:"Архив"};

export function MarketingCampaignList({campaigns}:{campaigns:Campaign[]}){
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("ALL");
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const visible=useMemo(()=>campaigns.filter(item=>(status==="ALL"||item.status===status)&&item.name.toLowerCase().includes(query.toLowerCase())),[campaigns,query,status]);

  async function act(action:"duplicate"|"archive"|"rename",campaignId:string,name?:string){
    setBusy(campaignId);setNotice("");
    const response=await fetch("/api/admin/marketing/campaigns",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action,campaignId,name})});
    const data=await response.json();setBusy("");
    if(!response.ok)return setNotice(data.error||"Не удалось выполнить действие");
    setNotice(action==="duplicate"?"Кампания продублирована":action==="archive"?"Кампания отправлена в архив":"Название обновлено");
    router.refresh();
  }

  return <div className="card">
    <div className="row between"><div><span className="eyebrow">Управление кампаниями</span><h2>Черновики и история</h2></div><span className="pill">{campaigns.length} кампаний</span></div>
    <div className="row" style={{marginBottom:16}}>
      <input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию" />
      <select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">Все статусы</option><option value="DRAFT">Черновики</option><option value="SCHEDULED">Запланированные</option><option value="COMPLETED">Завершённые</option><option value="ARCHIVED">Архив</option></select>
    </div>
    {notice&&<div className="toast">{notice}</div>}
    <div className="table-wrap"><table><thead><tr><th>Кампания</th><th>Канал</th><th>Статус</th><th>Получатели</th><th>Стоимость</th><th>Создана</th><th>Действия</th></tr></thead><tbody>
      {visible.map(item=><tr key={item.id}><td><strong>{item.name}</strong><br/><small>{item.message.slice(0,80)}{item.message.length>80?"…":""}</small></td><td>{item.channel}</td><td><span className="pill">{labels[item.status]||item.status}</span></td><td>{item.estimatedRecipients}</td><td>₪{(item.estimatedCostMinor/100).toFixed(2)}</td><td>{new Date(item.createdAt).toLocaleDateString("ru-IL")}</td><td><div className="row"><button className="btn secondary" disabled={busy===item.id} onClick={()=>void act("duplicate",item.id)}>Копия</button><button className="btn secondary" disabled={busy===item.id||item.status==="ARCHIVED"} onClick={()=>void act("archive",item.id)}>Архив</button><button className="btn secondary" disabled={busy===item.id} onClick={()=>{const name=window.prompt("Новое название кампании",item.name);if(name?.trim())void act("rename",item.id,name.trim());}}>Переименовать</button></div></td></tr>)}
      {!visible.length&&<tr><td colSpan={7}>Кампаний по выбранному фильтру нет.</td></tr>}
    </tbody></table></div>
  </div>;
}
