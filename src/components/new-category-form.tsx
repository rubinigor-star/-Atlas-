"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCategoryForm({eventId}:{eventId:string}){
 const router=useRouter();
 const[open,setOpen]=useState(false);
 const[pricingMode,setPricingMode]=useState<"FIXED"|"SCHEDULED">("FIXED");
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage("");
  const form=new FormData(event.currentTarget);
  const iso=(name:string)=>new Date(String(form.get(name))).toISOString();
  const body={action:"category",name:String(form.get("name")),description:String(form.get("description")||""),priceMinor:Math.round(Number(form.get("price"))*100),capacity:Number(form.get("capacity")),colorHex:String(form.get("colorHex")),pricingMode,salesStart:iso("salesStart"),salesEnd:iso("salesEnd"),earlyBirdPriceMinor:pricingMode==="SCHEDULED"?Math.round(Number(form.get("earlyBirdPrice"))*100):undefined,earlyBirdEndsAt:pricingMode==="SCHEDULED"?iso("earlyBirdEndsAt"):undefined,maxPerOrder:Number(form.get("maxPerOrder"))};
  try{const response=await fetch(`/api/admin/events/${eventId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Не удалось создать билет");setMessage("Билет создан");setOpen(false);router.refresh();}
  catch(error){setMessage(error instanceof Error?error.message:"Не удалось создать билет");}
  finally{setBusy(false)}
 }
 return <section className="panel stack"><div className="row between"><div><span className="eyebrow">Билеты</span><h2>Новый билет</h2><p className="muted">Создайте новую категорию, затем при необходимости назначьте её местам на карте.</p></div><button type="button" className="btn" onClick={()=>setOpen(value=>!value)}>{open?"Закрыть":"Добавить билет"}</button></div>{open&&<form className="form" onSubmit={submit}><div className="form-grid three"><input className="input" name="name" placeholder="Название билета" required/><input className="input" name="capacity" type="number" min="1" placeholder="Количество" required/><label className="field"><span>Цвет на карте</span><input className="input color-input" name="colorHex" type="color" defaultValue="#2563EB"/></label></div><textarea name="description" rows={2} placeholder="Что входит в билет"/><div className="pricing-switch"><button type="button" className={pricingMode==="FIXED"?"active":""} onClick={()=>setPricingMode("FIXED")}>Фиксированная цена</button><button type="button" className={pricingMode==="SCHEDULED"?"active":""} onClick={()=>setPricingMode("SCHEDULED")}>Цена по расписанию</button></div>{pricingMode==="SCHEDULED"&&<div className="form-grid two"><label className="field"><span>Ранняя цена, ₪</span><input className="input" name="earlyBirdPrice" type="number" min="0" step="0.01" required/></label><label className="field"><span>Ранняя цена действует до</span><input className="input" name="earlyBirdEndsAt" type="datetime-local" required/></label></div>}<div className="form-grid two"><label className="field"><span>{pricingMode==="SCHEDULED"?"Основная цена, ₪":"Цена, ₪"}</span><input className="input" name="price" type="number" min="0" step="0.01" required/></label><label className="field"><span>Максимум в одном заказе</span><input className="input" name="maxPerOrder" type="number" min="1" max="20" defaultValue="10" required/></label></div><div className="form-grid two"><label className="field"><span>Начало продаж</span><input className="input" name="salesStart" type="datetime-local" required/></label><label className="field"><span>Окончание продаж</span><input className="input" name="salesEnd" type="datetime-local" required/></label></div><button className="btn dark" disabled={busy}>{busy?"Создаём…":"Создать билет"}</button></form>}{message&&<div className="toast" role="status">{message}</div>}</section>;
}
