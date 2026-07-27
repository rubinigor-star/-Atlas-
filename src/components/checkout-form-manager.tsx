"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guestFieldKeys, type GuestFieldConfig, type GuestFieldKey } from "@/lib/event-guest-fields";
import type { BuyerQuestion, BuyerQuestionType } from "@/lib/buyer-questions";

const labels: Record<GuestFieldKey, string> = {
  firstName: "Имя",
  lastName: "Фамилия",
  phone: "Телефон",
  email: "Email",
  birthDate: "Дата рождения",
  city: "Город проживания",
  facebook: "Facebook",
  instagram: "Instagram",
};
const types:{value:BuyerQuestionType;label:string}[]=[{value:"TEXT",label:"Короткий текст"},{value:"TEXTAREA",label:"Длинный текст"},{value:"SELECT",label:"Список вариантов"},{value:"CHECKBOX",label:"Чекбокс"},{value:"PHONE",label:"Телефон"},{value:"EMAIL",label:"Email"},{value:"DATE",label:"Дата"}];

export function CheckoutFormManager({eventId,initialGuestFields,initialQuestions}:{eventId:string;initialGuestFields:GuestFieldConfig;initialQuestions:BuyerQuestion[]}){
  const router=useRouter();
  const[guestFields,setGuestFields]=useState(initialGuestFields);
  const[questions,setQuestions]=useState(initialQuestions);
  const[message,setMessage]=useState("");
  const[saving,setSaving]=useState(false);
  function updateGuest(key:GuestFieldKey,part:"visible"|"required",value:boolean){setGuestFields(current=>({...current,[key]:{...current[key],[part]:value,...(part==="visible"&&!value?{required:false}:{})}}));}
  const update=(index:number,patch:Partial<BuyerQuestion>)=>setQuestions(items=>items.map((item,i)=>i===index?{...item,...patch}:item));
  const add=()=>setQuestions(items=>[...items,{id:crypto.randomUUID(),label:"",type:"TEXT",required:false,placeholder:""}]);
  const remove=(index:number)=>setQuestions(items=>items.filter((_,i)=>i!==index));
  const move=(index:number,delta:number)=>setQuestions(items=>{const next=[...items];const target=index+delta;if(target<0||target>=next.length)return items;[next[index],next[target]]=[next[target],next[index]];return next;});
  async function save(){setSaving(true);setMessage("");try{const response=await fetch(`/api/admin/events/${eventId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"checkout-form",guestFields,questions})});const data=await response.json().catch(()=>({error:"Сервер вернул некорректный ответ"}));if(!response.ok)throw new Error(data.error||"Не удалось сохранить");setMessage("✓ Форма оформления сохранена");router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"Ошибка");}finally{setSaving(false);}}
  return <section className="panel form"><div><span className="eyebrow">Оформление заказа</span><h2>Какие данные клиент указывает при покупке</h2><p className="muted">Здесь находится вся форма покупателя: стандартные данные гостя и дополнительные вопросы. Изменения сразу применяются к новым заказам.</p></div>
    <h3>Основные данные гостя</h3><div className="table-wrap"><table><thead><tr><th>Поле</th><th>Показывать</th><th>Обязательно</th></tr></thead><tbody>{guestFieldKeys.map(key=><tr key={key}><td><strong>{labels[key]}</strong></td><td><input type="checkbox" checked={guestFields[key].visible} onChange={e=>updateGuest(key,"visible",e.target.checked)}/></td><td><input type="checkbox" checked={guestFields[key].required} disabled={!guestFields[key].visible} onChange={e=>updateGuest(key,"required",e.target.checked)}/></td></tr>)}</tbody></table></div>
    <div className="row between"><div><h3>Дополнительные вопросы</h3><p className="muted">Они идут после основных данных гостя.</p></div><button type="button" className="btn secondary" onClick={add}>+ Добавить вопрос</button></div>
    {questions.length===0&&<div className="toast">Дополнительных вопросов пока нет.</div>}
    {questions.map((question,index)=><div key={question.id} className="panel form" style={{padding:16}}><div className="row between"><strong>Вопрос {index+1}</strong><div className="row"><button type="button" className="btn secondary" onClick={()=>move(index,-1)} disabled={index===0}>↑</button><button type="button" className="btn secondary" onClick={()=>move(index,1)} disabled={index===questions.length-1}>↓</button><button type="button" className="btn secondary" onClick={()=>remove(index)}>Удалить</button></div></div><div className="form-grid two"><div className="field"><label>Текст вопроса</label><input className="input" value={question.label} onChange={e=>update(index,{label:e.target.value})}/></div><div className="field"><label>Тип ответа</label><select className="input" value={question.type} onChange={e=>update(index,{type:e.target.value as BuyerQuestionType})}>{types.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></div></div>{question.type==="SELECT"&&<div className="field"><label>Варианты — по одному в строке</label><textarea rows={3} value={(question.options||[]).join("\n")} onChange={e=>update(index,{options:e.target.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)})}/></div>}<div className="form-grid two"><div className="field"><label>Подсказка</label><input className="input" value={question.placeholder||""} onChange={e=>update(index,{placeholder:e.target.value})}/></div><label className="field"><span>Обязательный вопрос</span><input type="checkbox" checked={question.required} onChange={e=>update(index,{required:e.target.checked})}/></label></div></div>)}
    <div className="row"><button type="button" className="btn" onClick={()=>void save()} disabled={saving}>{saving?"Сохраняю…":"Сохранить форму оформления"}</button>{message&&<div className="toast">{message}</div>}</div>
  </section>;
}
