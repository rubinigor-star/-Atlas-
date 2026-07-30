"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Channel="EMAIL"|"SMS"|"WHATSAPP";
type Props={customers:Array<{city:string|null;orders:number;totalMinor:number;email:string;phone:string}>;events:Array<{id:string;title:string}>};
type Template={id:string;label:string;channels:Channel[];subject?:string;message:string};

const rates:Record<Channel,number>={EMAIL:8,SMS:22,WHATSAPP:35};
const variables=["{{first_name}}","{{event_name}}","{{event_date}}","{{venue}}","{{order_number}}","{{ticket_link}}","{{unsubscribe_link}}"] as const;
const samples:Record<string,string>={
  "{{first_name}}":"Игорь",
  "{{event_name}}":"Большой концерт Atlas",
  "{{event_date}}":"18 сентября 2026, 20:00",
  "{{venue}}":"Reading 3, Тель-Авив",
  "{{order_number}}":"AT-10482",
  "{{ticket_link}}":"atlas.co.il/t/AT-10482",
  "{{unsubscribe_link}}":"atlas.co.il/u/example",
};
const templates:Template[]=[
  {id:"announcement",label:"Анонс мероприятия",channels:["EMAIL","SMS","WHATSAPP"],subject:"{{event_name}} - билеты уже в продаже",message:"Здравствуйте, {{first_name}}!\n\nОткрыта продажа билетов на {{event_name}}.\nДата: {{event_date}}\nМесто: {{venue}}\n\nКупить билет: {{ticket_link}}\n\nОтписаться от рекламы: {{unsubscribe_link}}"},
  {id:"last-call",label:"Последние билеты",channels:["EMAIL","SMS","WHATSAPP"],subject:"Последние билеты на {{event_name}}",message:"{{first_name}}, на {{event_name}} осталось мало билетов. Мероприятие состоится {{event_date}} в {{venue}}. Билеты: {{ticket_link}}. Отписка: {{unsubscribe_link}}"},
  {id:"return",label:"Вернуть клиента",channels:["EMAIL","WHATSAPP"],subject:"Мы приготовили для вас новое событие",message:"Здравствуйте, {{first_name}}! Давно вас не видели. Возможно, вам понравится {{event_name}} - {{event_date}}, {{venue}}. Подробнее: {{ticket_link}}. Отписка: {{unsubscribe_link}}"},
];

function renderPreview(value:string){return variables.reduce((text,key)=>text.split(key).join(samples[key]),value);}

export function MarketingCampaignBuilder({customers,events}:Props){
  const router=useRouter();
  const [channel,setChannel]=useState<Channel>("EMAIL");
  const [city,setCity]=useState("");
  const [minOrders,setMinOrders]=useState(1);
  const [eventId,setEventId]=useState("");
  const [name,setName]=useState("");
  const [subject,setSubject]=useState("");
  const [message,setMessage]=useState("");
  const [templateId,setTemplateId]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const cities=useMemo(()=>[...new Set(customers.map(item=>item.city).filter(Boolean) as string[])].sort(),[customers]);
  const matching=useMemo(()=>customers.filter(customer=>(!city||customer.city===city)&&customer.orders>=minOrders&&(channel==="EMAIL"?Boolean(customer.email):Boolean(customer.phone))),[customers,city,minOrders,channel]);
  const estimatedCost=matching.length*rates[channel];
  const selectedEvent=events.find(event=>event.id===eventId);
  const previewSubject=renderPreview(subject).replace("Большой концерт Atlas",selectedEvent?.title||"Большой концерт Atlas");
  const previewMessage=renderPreview(message).replaceAll("Большой концерт Atlas",selectedEvent?.title||"Большой концерт Atlas");
  const smsParts=channel==="SMS"?Math.max(1,Math.ceil(message.length/160)):0;

  function applyTemplate(id:string){
    setTemplateId(id);
    const template=templates.find(item=>item.id===id);
    if(!template)return;
    setSubject(template.subject||"");
    setMessage(template.message);
    if(!name)setName(template.label);
  }

  function insertVariable(variable:string){setMessage(current=>`${current}${current&& !current.endsWith(" ")?" ":""}${variable}`);}

  async function save(){
    setBusy(true);setNotice("");
    const response=await fetch("/api/admin/marketing/campaigns",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,channel,eventId:eventId||null,subject:channel==="EMAIL"?subject:null,message,templateId:templateId||null,variablesUsed:variables.filter(variable=>message.includes(variable)||subject.includes(variable)),segment:{city:city||null,minOrders},estimatedRecipients:matching.length,estimatedCostMinor:estimatedCost})});
    const data=await response.json();setBusy(false);
    if(!response.ok)return setNotice(data.error||"Не удалось сохранить кампанию");
    setNotice(`Черновик сохранён. Сервер подтвердил ${data.serverEstimate?.recipients??0} получателей и стоимость ₪${((data.serverEstimate?.costMinor??0)/100).toFixed(2)}.`);router.refresh();
  }

  return <div className="card">
    <div className="row between"><div><span className="eyebrow">Новая рассылка</span><h2>Редактор кампании</h2></div><span className="pill">Без отправки</span></div>
    <div className="form-grid">
      <label>Название<input value={name} onChange={e=>setName(e.target.value)} placeholder="Повторная продажа концерта" /></label>
      <label>Канал<select value={channel} onChange={e=>{const next=e.target.value as Channel;setChannel(next);if(next!=="EMAIL")setSubject("");}}><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option></select></label>
      <label>Шаблон<select value={templateId} onChange={e=>applyTemplate(e.target.value)}><option value="">Без шаблона</option>{templates.filter(item=>item.channels.includes(channel)).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Мероприятие<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Все мероприятия</option>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
      <label>Город<select value={city} onChange={e=>setCity(e.target.value)}><option value="">Все города</option>{cities.map(item=><option key={item}>{item}</option>)}</select></label>
      <label>Минимум заказов<input type="number" min="1" value={minOrders} onChange={e=>setMinOrders(Math.max(1,Number(e.target.value)||1))}/></label>
      {channel==="EMAIL"&&<label style={{gridColumn:"1/-1"}}>Тема письма<input value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)} placeholder="Тема, которую увидит получатель"/><small>{subject.length}/200</small></label>}
      <label style={{gridColumn:"1/-1"}}>Сообщение<textarea rows={8} value={message} maxLength={5000} onChange={e=>setMessage(e.target.value)} placeholder="Текст рекламного сообщения с обязательной возможностью отписки" /><small>{message.length}/5000{channel==="SMS"?` · примерно ${smsParts} SMS`:""}</small></label>
    </div>
    <div className="row" style={{flexWrap:"wrap",gap:8,marginTop:12}}>{variables.map(variable=><button key={variable} className="btn secondary" type="button" onClick={()=>insertVariable(variable)}>{variable}</button>)}</div>
    <div className="card" style={{marginTop:16,background:"var(--surface-soft, #f8fafc)"}}><div className="row between"><div><span className="eyebrow">Предпросмотр</span><h3>{channel==="EMAIL"?(previewSubject||"Без темы"):channel}</h3></div><span className="pill">Тестовые данные</span></div><div style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{previewMessage||"Сообщение появится здесь"}</div></div>
    <div className="stats" style={{marginTop:16}}><div className="stat"><span className="muted">Подходят по сегменту</span><strong>{matching.length}</strong><small>до серверной проверки согласий</small></div><div className="stat"><span className="muted">Тариф за контакт</span><strong>₪{(rates[channel]/100).toFixed(2)}</strong><small>предварительная ставка</small></div><div className="stat"><span className="muted">Оценка стоимости</span><strong>₪{(estimatedCost/100).toFixed(2)}</strong><small>сервер пересчитает</small></div></div>
    {notice&&<div className="toast">{notice}</div>}
    <button className="btn" type="button" disabled={busy||name.trim().length<2||message.trim().length<3||(channel==="EMAIL"&&subject.trim().length<2)} onClick={save}>{busy?"Сохраняю...":"Сохранить черновик"}</button>
  </div>;
}
