"use client";

import { Fragment, useState } from "react";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

const copy={
 ru:{name:"Название билета",quantity:"Количество билетов",mapColor:"Цвет на карте",includes:"Что входит в билет",fixed:"Одна цена",fixedHelp:"Цена не меняется в течение продаж",scheduled:"Цена повысится",scheduledHelp:"Сначала одна цена, затем автоматически следующая",currentStage:"Текущий этап",nextStage:"Следующий этап",currentPrice:"Текущая цена, ₪",nextPrice:"Следующая цена, ₪",changesAt:"Текущая цена действует до",maxOrder:"Максимум в заказе",salesStart:"Начало продаж билета",salesEnd:"Окончание продаж билета",soldHelp:"Уже продано билетов: {n}. Количество нельзя уменьшить ниже этого числа.",saveChanges:"Сохранить",saving:"Сохраняем...",saved:"Сохранено",category:"Категория",priceNow:"Цена сейчас",sold:"Продано",remaining:"Остаток",hidden:"Скрыта от покупателей",bySchedule:"цена изменится",cancel:"Отмена",edit:"Настроить",show:"Показать",hide:"Скрыть",previewFixed:"Покупатель всегда видит одну цену",previewScheduled:"На следующий день Atlas автоматически включит следующую цену",simpleNote:"Организатор задаёт только цены и календарные даты. Время здесь не используется: Atlas сам применяет начало и конец выбранного дня.",saveError:"Не удалось сохранить настройки. Проверьте выбранные даты и попробуйте снова."},
 he:{name:"שם הכרטיס",quantity:"כמות כרטיסים",mapColor:"צבע במפה",includes:"מה כלול בכרטיס",fixed:"מחיר אחד",fixedHelp:"המחיר אינו משתנה במהלך המכירה",scheduled:"המחיר יעלה",scheduledHelp:"מחיר ראשון ולאחר מכן מעבר אוטומטי למחיר הבא",currentStage:"שלב נוכחי",nextStage:"שלב הבא",currentPrice:"מחיר נוכחי, ₪",nextPrice:"מחיר הבא, ₪",changesAt:"המחיר הנוכחי בתוקף עד",maxOrder:"מקסימום בהזמנה",salesStart:"תחילת מכירת הכרטיס",salesEnd:"סיום מכירת הכרטיס",soldHelp:"נמכרו כבר {n} כרטיסים. לא ניתן להקטין את הכמות מתחת למספר זה.",saveChanges:"שמירה",saving:"שומר...",saved:"נשמר",category:"קטגוריה",priceNow:"מחיר נוכחי",sold:"נמכרו",remaining:"נותרו",hidden:"מוסתר מהרוכשים",bySchedule:"המחיר ישתנה",cancel:"ביטול",edit:"הגדרה",show:"הצגה",hide:"הסתרה",previewFixed:"הקונה רואה מחיר אחד",previewScheduled:"ביום הבא Atlas יעבור אוטומטית למחיר הבא",simpleNote:"המארגן מגדיר רק מחירים ותאריכים. אין שימוש בשעות: Atlas מחיל אוטומטית את תחילת וסוף היום שנבחר.",saveError:"לא ניתן לשמור. בדקו את התאריכים ונסו שוב."},
 en:{name:"Ticket name",quantity:"Ticket quantity",mapColor:"Map color",includes:"What is included",fixed:"One price",fixedHelp:"The price stays unchanged during sales",scheduled:"Price will increase",scheduledHelp:"Start with one price, then switch automatically",currentStage:"Current stage",nextStage:"Next stage",currentPrice:"Current price, ₪",nextPrice:"Next price, ₪",changesAt:"Current price is valid through",maxOrder:"Maximum per order",salesStart:"Ticket sales start",salesEnd:"Ticket sales end",soldHelp:"{n} tickets have already been sold. Capacity cannot be reduced below this number.",saveChanges:"Save",saving:"Saving...",saved:"Saved",category:"Category",priceNow:"Current price",sold:"Sold",remaining:"Remaining",hidden:"Hidden from buyers",bySchedule:"price changes",cancel:"Cancel",edit:"Configure",show:"Show",hide:"Hide",previewFixed:"The buyer always sees one price",previewScheduled:"Atlas activates the next price on the following day",simpleNote:"The organizer sets prices and calendar dates only. Times are not used here: Atlas applies the beginning and end of the selected day automatically.",saveError:"Could not save. Check the selected dates and try again."}
} as const;

type Tier={id:string;label:string;priceMinor:number;startsAt:string;endsAt:string};
export type ManagedCategory={id:string;name:string;description:string|null;priceMinor:number;pricingMode:"FIXED"|"SCHEDULED";capacity:number;sold:number;hidden:boolean;colorHex:string;maxPerOrder:number;salesStart:string|null;salesEnd:string|null;priceTiers:Tier[];currentPriceMinor:number|null;statusLabel:string;nextTierPriceMinor?:number;nextTierStartsAt?:string};

function dateInput(iso:string|null|undefined){return iso?new Date(iso).toISOString().slice(0,10):"";}
function startOfDayIso(value:FormDataEntryValue|null){
 const date=String(value||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("INVALID_DATE");
 return new Date(`${date}T00:00:00.000`).toISOString();
}
function endOfDayIso(value:FormDataEntryValue|null){
 const date=String(value||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("INVALID_DATE");
 return new Date(`${date}T23:59:59.999`).toISOString();
}
function nextDayStartIso(value:FormDataEntryValue|null){
 const date=String(value||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("INVALID_DATE");
 const next=new Date(`${date}T00:00:00.000`);next.setDate(next.getDate()+1);return next.toISOString();
}

function CategoryEditForm({category,onSave,busy,error}:{category:ManagedCategory;onSave:(body:Record<string,unknown>)=>Promise<void>;busy:boolean;error:string}){
 const{locale}=useLocale();const text=copy[locale];const[pricingMode,setPricingMode]=useState<"FIXED"|"SCHEDULED">(category.pricingMode);const earlyTier=category.priceTiers[0];const regularTier=category.priceTiers[1];
 const initialCurrent=(earlyTier?.priceMinor??category.currentPriceMinor??category.priceMinor)/100;
 const initialNext=(regularTier?.priceMinor??category.priceMinor)/100;
 const changeDate=earlyTier?.endsAt?new Date(new Date(earlyTier.endsAt).getTime()-1000).toISOString():category.nextTierStartsAt?new Date(new Date(category.nextTierStartsAt).getTime()-86400000).toISOString():null;
 return <form className="pricing-stage-editor" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{const salesStart=startOfDayIso(form.get("salesStart"));const salesEnd=endOfDayIso(form.get("salesEnd"));const changeAt=pricingMode==="SCHEDULED"?nextDayStartIso(form.get("changeDate")):undefined;await onSave({name:form.get("name"),description:form.get("description"),colorHex:form.get("colorHex"),priceMinor:Math.round(Number(form.get(pricingMode==="SCHEDULED"?"nextPrice":"currentPrice"))*100),capacity:Number(form.get("capacity")),pricingMode,salesStart,salesEnd,earlyBirdPriceMinor:pricingMode==="SCHEDULED"?Math.round(Number(form.get("currentPrice"))*100):undefined,earlyBirdEndsAt:changeAt,maxPerOrder:Number(form.get("maxPerOrder"))});}catch{await onSave({__clientError:text.saveError});}}}>
  <div className="form-grid three"><div className="field"><label>{text.name}</label><input className="input" name="name" defaultValue={category.name} required/></div><div className="field"><label>{text.quantity}</label><input className="input" name="capacity" type="number" min={category.sold} defaultValue={category.capacity} required/></div><label className="field"><span>{text.mapColor}</span><input className="input color-input" name="colorHex" type="color" defaultValue={category.colorHex}/></label></div>
  <div className="field"><label>{text.includes}</label><textarea name="description" rows={2} defaultValue={category.description??""}/></div>
  <div className="pricing-stage-mode"><button type="button" className={pricingMode==="FIXED"?"active":""} onClick={()=>setPricingMode("FIXED")}><strong>{text.fixed}</strong><small>{text.fixedHelp}</small></button><button type="button" className={pricingMode==="SCHEDULED"?"active":""} onClick={()=>setPricingMode("SCHEDULED")}><strong>{text.scheduled}</strong><small>{text.scheduledHelp}</small></button></div>
  {pricingMode==="FIXED"?<div className="pricing-stage-card current"><span className="stage-label">{text.currentStage}</span><div className="field"><label>{text.currentPrice}</label><input className="input" name="currentPrice" type="number" min="0" step="0.01" defaultValue={initialNext} required/></div><div className="pricing-stage-preview"><div><small>{category.name}</small><div>{text.previewFixed}</div></div><strong>{money(Math.round(initialNext*100))}</strong></div></div>:<div className="pricing-stage-flow"><div className="pricing-stage-card current"><span className="stage-label">{text.currentStage}</span><div className="field"><label>{text.currentPrice}</label><input className="input" name="currentPrice" type="number" min="0" step="0.01" defaultValue={initialCurrent} required/></div><div className="field"><label>{text.changesAt}</label><input className="input" name="changeDate" type="date" defaultValue={dateInput(changeDate)} required/></div></div><div className="pricing-stage-arrow">→</div><div className="pricing-stage-card"><span className="stage-label">{text.nextStage}</span><div className="field"><label>{text.nextPrice}</label><input className="input" name="nextPrice" type="number" min="0" step="0.01" defaultValue={initialNext} required/></div><div className="pricing-stage-preview"><div><small>{category.name}</small><div>{text.previewScheduled}</div></div><strong>{money(Math.round(initialNext*100))}</strong></div></div></div>}
  <div className="pricing-stage-help">{text.simpleNote}</div>
  <div className="form-grid three"><div className="field"><label>{text.maxOrder}</label><input className="input" name="maxPerOrder" type="number" min="1" max="20" defaultValue={category.maxPerOrder} required/></div><div className="field"><label>{text.salesStart}</label><input className="input" name="salesStart" type="date" defaultValue={dateInput(category.salesStart)} required/></div><div className="field"><label>{text.salesEnd}</label><input className="input" name="salesEnd" type="date" defaultValue={dateInput(category.salesEnd)} required/></div></div>
  <p className="muted" style={{fontSize:13}}>{text.soldHelp.replace("{n}",String(category.sold))}</p>{error&&<div className="toast" role="alert">{error}</div>}<button className="btn" disabled={busy}>{busy?text.saving:text.saveChanges}</button>
 </form>;
}

export function CategoryManager({eventId,categories}:{eventId:string;categories:ManagedCategory[]}){
 const{locale}=useLocale();const text=copy[locale];const[editingId,setEditingId]=useState<string|null>(null);const[message,setMessage]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 async function send(body:Record<string,unknown>){
  if(body.__clientError){setError(String(body.__clientError));return;}
  setMessage("");setError("");setBusy(true);
  try{
   const response=await fetch(`/api/admin/events/${eventId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   const raw=await response.text();let data:{error?:string}={};try{data=raw?JSON.parse(raw):{};}catch{}
   if(!response.ok){setError(data.error||text.saveError);return;}
   setMessage(text.saved);setEditingId(null);
   window.setTimeout(()=>window.location.reload(),250);
  }catch{setError(text.saveError);}finally{setBusy(false);}
 }
 return <div className="table-wrap"><table><thead><tr><th>{text.category}</th><th>{text.priceNow}</th><th>{text.sold}</th><th>{text.remaining}</th><th/></tr></thead><tbody>{categories.map(item=><Fragment key={item.id}><tr style={item.hidden?{opacity:.55}:undefined}><td><strong>{item.name}</strong>{item.hidden&&<div className="muted" style={{fontSize:12,marginTop:2}}>{text.hidden}</div>}</td><td>{item.currentPriceMinor!==null?money(item.currentPriceMinor):<span className="muted">{item.statusLabel}</span>}{item.pricingMode==="SCHEDULED"&&<div className="pill" style={{marginTop:6}}>{text.bySchedule}</div>}{item.nextTierPriceMinor!==undefined&&item.nextTierStartsAt&&<div className="muted" style={{fontSize:12,marginTop:4}}>{money(item.nextTierPriceMinor)} · {new Date(item.nextTierStartsAt).toLocaleDateString(locale==="he"?"he-IL":locale==="en"?"en-IL":"ru-RU")}</div>}</td><td>{item.sold}</td><td>{item.capacity-item.sold}</td><td><div className="row"><button type="button" className="btn secondary" onClick={()=>{setError("");setEditingId(editingId===item.id?null:item.id);}}>{editingId===item.id?text.cancel:text.edit}</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>void send({action:"category-visibility",categoryId:item.id,hidden:!item.hidden})}>{item.hidden?text.show:text.hide}</button></div></td></tr>{editingId===item.id&&<tr><td colSpan={5}><CategoryEditForm category={item} busy={busy} error={error} onSave={body=>send({action:"category-update",categoryId:item.id,...body})}/></td></tr>}</Fragment>)}</tbody></table>{message&&<div className="toast">{message}</div>}</div>;
}
