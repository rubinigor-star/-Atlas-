"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Channel="EMAIL"|"SMS"|"WHATSAPP";
type Props={customers:Array<{key:string;city:string|null;orders:number;totalMinor:number;email:string;phone:string}>;events:Array<{id:string;title:string}>};

const rates:Record<Channel,number>={EMAIL:8,SMS:22,WHATSAPP:35};

export function MarketingCampaignBuilder({customers,events}:Props){
  const router=useRouter();
  const [channel,setChannel]=useState<Channel>("EMAIL");
  const [city,setCity]=useState("");
  const [minOrders,setMinOrders]=useState(1);
  const [eventId,setEventId]=useState("");
  const [name,setName]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const cities=useMemo(()=>[...new Set(customers.map(item=>item.city).filter(Boolean) as string[])].sort(),[customers]);
  const matching=useMemo(()=>customers.filter(customer=>(!city||customer.city===city)&&customer.orders>=minOrders&&(channel==="EMAIL"?Boolean(customer.email):Boolean(customer.phone))),[customers,city,minOrders,channel]);
  const estimatedCost=matching.length*rates[channel];

  async function save(){
    setBusy(true);setNotice("");
    const response=await fetch("/api/admin/marketing/campaigns",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,channel,eventId:eventId||null,message,segment:{city:city||null,minOrders},estimatedRecipients:matching.length,estimatedCostMinor:estimatedCost})});
    const data=await response.json();setBusy(false);
    if(!response.ok)return setNotice(data.error||"Не удалось сохранить кампанию");
    setNotice("Черновик кампании сохранён. Отправка остаётся заблокированной до подтверждения согласий и тарифов.");router.refresh();
  }

  return <div className="card">
    <div className="row between"><div><span className="eyebrow">Новая рассылка</span><h2>Создать черновик кампании</h2></div><span className="pill">Без отправки</span></div>
    <div className="form-grid">
      <label>Название<input value={name} onChange={e=>setName(e.target.value)} placeholder="Повторная продажа концерта" /></label>
      <label>Канал<select value={channel} onChange={e=>setChannel(e.target.value as Channel)}><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option></select></label>
      <label>Мероприятие<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Все мероприятия</option>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
      <label>Город<select value={city} onChange={e=>setCity(e.target.value)}><option value="">Все города</option>{cities.map(item=><option key={item}>{item}</option>)}</select></label>
      <label>Минимум заказов<input type="number" min="1" value={minOrders} onChange={e=>setMinOrders(Math.max(1,Number(e.target.value)||1))}/></label>
      <label style={{gridColumn:"1/-1"}}>Сообщение<textarea rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Текст рекламного сообщения с обязательной возможностью отписки" /></label>
    </div>
    <div className="stats" style={{marginTop:16}}><div className="stat"><span className="muted">Подходят по сегменту</span><strong>{matching.length}</strong><small>до проверки согласий</small></div><div className="stat"><span className="muted">Тариф за контакт</span><strong>₪{(rates[channel]/100).toFixed(2)}</strong><small>предварительная ставка</small></div><div className="stat"><span className="muted">Оценка стоимости</span><strong>₪{(estimatedCost/100).toFixed(2)}</strong><small>без резервирования средств</small></div></div>
    {notice&&<div className="toast">{notice}</div>}
    <button className="btn" type="button" disabled={busy||name.trim().length<2||message.trim().length<3} onClick={save}>{busy?"Сохраняю…":"Сохранить черновик"}</button>
  </div>;
}
