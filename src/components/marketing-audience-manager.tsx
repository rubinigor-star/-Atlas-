"use client";

import { useMemo, useState } from "react";

type Channel="EMAIL"|"SMS"|"WHATSAPP";
type Customer={guestId:string|null;name:string;email:string;phone:string;city:string|null;orders:number;totalMinor:number;consents:Partial<Record<Channel,"GRANTED"|"REVOKED"|"UNKNOWN">>;suppressed:Channel[];fullySuppressed:boolean};

const labels:Record<Channel,string>={EMAIL:"Email",SMS:"SMS",WHATSAPP:"WhatsApp"};
const defaultRates:Record<Channel,number>={EMAIL:2,SMS:18,WHATSAPP:25};

export function MarketingAudienceManager({customers}:{customers:Customer[]}){
  const [channel,setChannel]=useState<Channel>("EMAIL");
  const [city,setCity]=useState("");
  const [minOrders,setMinOrders]=useState(1);
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const [rows,setRows]=useState(customers);

  const filtered=useMemo(()=>rows.filter(customer=>(!city||customer.city===city)&&customer.orders>=minOrders),[rows,city,minOrders]);
  const eligible=filtered.filter(customer=>customer.guestId&&customer.consents[channel]==="GRANTED"&&!customer.fullySuppressed&&!customer.suppressed.includes(channel));
  const excluded=filtered.length-eligible.length;
  const estimatedCost=eligible.length*defaultRates[channel];
  const cities=[...new Set(rows.map(customer=>customer.city).filter((value):value is string=>Boolean(value)))].sort();

  async function act(customer:Customer,action:"GRANT"|"SUPPRESS",targetChannel:Channel|null=channel){
    if(!customer.guestId)return;
    const key=`${customer.guestId}-${action}-${targetChannel??"ALL"}`;
    setBusy(key);setNotice("");
    try{
      const response=await fetch("/api/admin/marketing/consents",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(action==="GRANT"?{action,guestId:customer.guestId,channel:targetChannel,consentTextVersion:"organizer-proof-v1",proofNote:"Подтверждено организатором в Atlas Office"}:{action,guestId:customer.guestId,channel:targetChannel,reason:"Запрос клиента на исключение из рекламных рассылок"})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||"Не удалось сохранить изменение");
      setRows(current=>current.map(row=>{
        if(row.guestId!==customer.guestId)return row;
        if(action==="GRANT"&&targetChannel)return {...row,consents:{...row.consents,[targetChannel]:"GRANTED"}};
        if(targetChannel)return {...row,consents:{...row.consents,[targetChannel]:"REVOKED"},suppressed:[...new Set([...row.suppressed,targetChannel])]};
        return {...row,fullySuppressed:true,consents:{EMAIL:"REVOKED",SMS:"REVOKED",WHATSAPP:"REVOKED"}};
      }));
      setNotice(action==="GRANT"?"Согласие сохранено с записью в журнале.":"Клиент исключён только из маркетинга. История покупок сохранена.");
    }catch(error){setNotice(error instanceof Error?error.message:"Ошибка");}finally{setBusy(null);}
  }

  return <>
    <div className="card"><div className="row between"><div><span className="eyebrow">Сегментация и стоимость</span><h2>Предварительный расчёт кампании</h2></div><span className="pill">Без отправки</span></div>
      <div className="grid-2"><label>Канал<select value={channel} onChange={event=>setChannel(event.target.value as Channel)}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Город<select value={city} onChange={event=>setCity(event.target.value)}><option value="">Все города</option>{cities.map(item=><option key={item}>{item}</option>)}</select></label><label>Минимум заказов<input type="number" min={1} value={minOrders} onChange={event=>setMinOrders(Math.max(1,Number(event.target.value)||1))}/></label><div><span className="muted">Тестовая ставка</span><h3>{(defaultRates[channel]/100).toLocaleString("ru-IL",{style:"currency",currency:"ILS"})} за сообщение</h3></div></div>
      <div className="stats"><div className="stat"><span className="muted">Найдено</span><strong>{filtered.length}</strong></div><div className="stat"><span className="muted">Разрешено</span><strong>{eligible.length}</strong></div><div className="stat"><span className="muted">Исключено</span><strong>{excluded}</strong></div><div className="stat"><span className="muted">Оценка</span><strong>{(estimatedCost/100).toLocaleString("ru-IL",{style:"currency",currency:"ILS"})}</strong><small>до НДС, без резервирования</small></div></div>
      <p className="muted">Пока используются демонстрационные ставки. Перед запуском провайдера тарифы будут задаваться суперюзером отдельно для каждого канала и организатора.</p>
    </div>

    <div className="card"><div className="row between"><div><span className="eyebrow">Согласия и отписки</span><h2>Управление маркетинговым статусом</h2></div><span className="pill">{rows.length} клиентов</span></div>{notice&&<p>{notice}</p>}
      <div className="table-wrap"><table><thead><tr><th>Клиент</th><th>Покупки</th><th>Email</th><th>SMS</th><th>WhatsApp</th><th>Действия</th></tr></thead><tbody>{rows.slice(0,50).map(customer=><tr key={customer.guestId??`${customer.email}-${customer.phone}`}><td><strong>{customer.name}</strong><br/><small>{customer.email||customer.phone}</small>{!customer.guestId&&<><br/><small>Нет CRM-карточки</small></>}</td><td>{customer.orders}</td>{(["EMAIL","SMS","WHATSAPP"] as Channel[]).map(item=><td key={item}><span className="pill">{customer.fullySuppressed||customer.suppressed.includes(item)?"Отписан":customer.consents[item]==="GRANTED"?"Разрешено":"Нет согласия"}</span></td>)}<td><div className="row"><button className="btn secondary" disabled={!customer.guestId||Boolean(busy)} onClick={()=>act(customer,"GRANT",channel)}>{busy===`${customer.guestId}-GRANT-${channel}`?"...":`Разрешить ${labels[channel]}`}</button><button className="btn secondary" disabled={!customer.guestId||Boolean(busy)} onClick={()=>act(customer,"SUPPRESS",channel)}>{`Отписать ${labels[channel]}`}</button><button className="btn secondary" disabled={!customer.guestId||Boolean(busy)} onClick={()=>act(customer,"SUPPRESS",null)}>Отписать от всего маркетинга</button></div></td></tr>)}</tbody></table></div>
      <p className="muted">Ручная фиксация согласия допустима только когда организатор действительно располагает доказательством. Atlas сохраняет источник, версию текста и сотрудника, выполнившего действие.</p>
    </div>
  </>;
}
