"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { israelCities } from "@/lib/israel-cities";
import type { GuestFieldConfig, GuestFieldKey } from "@/lib/event-guest-fields";
import type { Locale } from "@/lib/i18n";
import styles from "./checkout-form.module.css";

const copy = {
  ru: { contact:"Контактные данные", contactHelp:"Заполните данные покупателя", promo:"Промокод", promoPlaceholder:"Например, ATLAS10", apply:"Применить", payment:"Способ оплаты", secured:"Защищено HYP", paymentHelp:"Данные карты обрабатываются защищённой платёжной системой HYP и не попадают в Atlas.", paymentLoading:"Подготавливаем защищённую оплату…", order:"Ваш заказ", requested:"Запрашиваемый билет", quantity:"Количество", subtotal:"Стоимость билетов", fee:"Сервисный сбор", total:"Итого", afterApproval:"К оплате после одобрения", gender:"Пол", male:"Мужчина", female:"Женщина", chooseGender:"Выберите пол", promoter:"Персональная ссылка", extraPlaceholder:"Дополнительная информация для организатора", error:"Не удалось подготовить оплату", saveError:"Не удалось сохранить данные покупателя", review:"Списание произойдёт только после одобрения организатором" },
  he: { contact:"פרטי קשר", contactHelp:"מלאו את פרטי הרוכש", promo:"קוד הטבה", promoPlaceholder:"למשל ATLAS10", apply:"החל", payment:"אמצעי תשלום", secured:"מאובטח על ידי HYP", paymentHelp:"פרטי הכרטיס מעובדים על ידי HYP ואינם נמסרים ל-Atlas.", paymentLoading:"מכינים תשלום מאובטח…", order:"ההזמנה שלך", requested:"הכרטיס המבוקש", quantity:"כמות", subtotal:"מחיר כרטיסים", fee:"עמלת שירות", total:"סה״כ", afterApproval:"לתשלום לאחר אישור", gender:"מגדר", male:"גבר", female:"אישה", chooseGender:"בחרו מגדר", promoter:"קישור אישי", extraPlaceholder:"מידע נוסף למפיק", error:"לא ניתן להכין את התשלום", saveError:"לא ניתן לשמור את פרטי הרוכש", review:"החיוב יתבצע רק לאחר אישור המפיק" },
  en: { contact:"Contact details", contactHelp:"Enter the buyer details", promo:"Promo code", promoPlaceholder:"For example ATLAS10", apply:"Apply", payment:"Payment method", secured:"Secured by HYP", paymentHelp:"Card details are processed securely by HYP and never reach Atlas.", paymentLoading:"Preparing secure payment…", order:"Your order", requested:"Requested ticket", quantity:"Quantity", subtotal:"Tickets", fee:"Service fee", total:"Total", afterApproval:"Due after approval", gender:"Gender", male:"Male", female:"Female", chooseGender:"Select gender", promoter:"Personal link", extraPlaceholder:"Additional information for organizer", error:"Could not prepare payment", saveError:"Could not save buyer details", review:"The card will be charged only after organizer approval" }
};

const labels: Record<GuestFieldKey, Record<Locale,string>> = {
  firstName:{ru:"Имя",he:"שם פרטי",en:"First name"}, lastName:{ru:"Фамилия",he:"שם משפחה",en:"Last name"}, phone:{ru:"Телефон",he:"טלפון",en:"Phone"}, email:{ru:"Email",he:"Email",en:"Email"}, birthDate:{ru:"Дата рождения",he:"תאריך לידה",en:"Date of birth"}, city:{ru:"Город проживания",he:"עיר מגורים",en:"City"}, facebook:{ru:"Facebook",he:"Facebook",en:"Facebook"}, instagram:{ru:"Instagram",he:"Instagram",en:"Instagram"}
};
const types: Partial<Record<GuestFieldKey,string>> = { phone:"tel", email:"email" };
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const birthDateError:Record<Locale,string>={ru:"Введите дату в формате ДД.ММ.ГГГГ",he:"יש להזין תאריך בפורמט DD.MM.YYYY",en:"Enter the date as DD.MM.YYYY"};
function formatBirthDate(value:string){const digits=value.replace(/\D/g,"").slice(0,8);return [digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join(".");}
function birthDateToIso(value:string){const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);if(!match)return "";const d=Number(match[1]),m=Number(match[2]),y=Number(match[3]);const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d||date.getTime()>Date.now()||y<1900)return "";return `${match[3]}-${match[2]}-${match[1]}`;}

type CheckoutItem={categoryId:string;quantity:number;tableId?:string|null;seatIds:string[]};
type CheckoutFormProps={eventId:string;categoryId:string;quantity:number;tableId?:string;seatIds?:string[];items?:CheckoutItem[];subtotal:number;serviceFee:number;total:number;serviceFeePayer:"BUYER"|"ORGANIZER";title:string;label:string;salesMode:"INSTANT"|"APPROVAL_REQUIRED";approvalInstructions?:string|null;referralCode?:string;promoterLabel?:string;recoveryToken?:string;guestFields:GuestFieldConfig};
type RecoveryCustomer={firstName?:string;lastName?:string;email?:string;phone?:string;gender?:string};

export function CheckoutForm(props:CheckoutFormProps){
  const {locale}=useLocale();const text=copy[locale];const approvalRequired=props.salesMode==="APPROVAL_REQUIRED";const hasOrganizerQuestion=approvalRequired&&Boolean(props.approvalInstructions?.trim());const visible=(Object.keys(props.guestFields) as GuestFieldKey[]).filter(key=>props.guestFields[key].visible);
  const [busy,setBusy]=useState(true);const [error,setError]=useState("");const [promo,setPromo]=useState("");const [paymentUrl,setPaymentUrl]=useState("");const [contactSaved,setContactSaved]=useState(false);const [preparedOrder,setPreparedOrder]=useState("");
  const tokenRef=useRef("");const orderKeyRef=useRef("");const formRef=useRef<HTMLFormElement|null>(null);const iframeRef=useRef<HTMLIFrameElement|null>(null);const contactTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);const preparingRef=useRef(false);
  function token(){if(tokenRef.current)return tokenRef.current;const key=`atlas-abandon-${props.eventId}-${props.categoryId}-${props.tableId||props.seatIds?.join("-")||"general"}`;const recovery=props.recoveryToken&&uuidPattern.test(props.recoveryToken)?props.recoveryToken:"";const existing=sessionStorage.getItem(key);const value=recovery||existing||crypto.randomUUID();sessionStorage.setItem(key,value);tokenRef.current=value;return value;}
  function orderKey(){if(!orderKeyRef.current)orderKeyRef.current=crypto.randomUUID();return orderKeyRef.current;}
  function capture(stage:"CHECKOUT_OPENED"|"CONTACTS_ENTERED"|"PAYMENT_STARTED",customer:RecoveryCustomer={}){void fetch("/api/checkout/abandon",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:token(),eventId:props.eventId,categoryId:props.categoryId,quantity:props.quantity,amountMinor:props.total,stage,checkoutUrl:window.location.href,customer,metadata:{tableId:props.tableId||null,seatIds:props.seatIds||[],items:props.items||null,label:props.label,referralCode:props.referralCode||null}}),keepalive:true}).catch(()=>undefined);}
  function handleBirthDateInput(event:React.FormEvent<HTMLInputElement>){const input=event.currentTarget;const formatted=formatBirthDate(input.value);if(input.value!==formatted)input.value=formatted;input.setCustomValidity(!formatted||birthDateToIso(formatted)?"":birthDateError[locale]);}
  function handlePaymentFrameLoad(){const frame=iframeRef.current;if(!frame)return;try{const href=frame.contentWindow?.location.href;if(!href)return;const url=new URL(href);if(url.origin===window.location.origin&&(url.pathname.startsWith("/orders/")||url.pathname==="/payments/hyp/result"))window.location.assign(url.toString());}catch{/* cross-origin HYP frame */}}
  async function cancelPrepared(){if(!preparedOrder||!orderKeyRef.current)return;await fetch(`/api/orders/${preparedOrder}/checkout-contact`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({idempotencyKey:orderKeyRef.current})}).catch(()=>undefined);}
  async function preparePayment(promoCode=""){
    if(preparingRef.current)return;preparingRef.current=true;setBusy(true);setError("");
    try{
      const technicalId=crypto.randomUUID().slice(0,8);const customer={firstName:"Atlas",lastName:"Checkout",email:`checkout-${technicalId}@guest.atlas.local`,phone:"0500000000",gender:"MALE",birthDate:"1990-01-01",city:"Checkout",facebook:"-",instagram:"-"};
      const endpoint=props.items?.length?"/api/checkout/cart":"/api/checkout";const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:props.eventId,categoryId:props.categoryId,quantity:props.quantity,tableId:props.tableId||null,seatIds:props.seatIds||undefined,items:props.items,promoCode:promoCode||undefined,referralCode:props.referralCode||undefined,eligibilityAnswer:hasOrganizerQuestion?"pending":undefined,customer,payment:{method:"CARD"},locale,idempotencyKey:orderKey(),abandonToken:token()})});const data=await response.json();if(!response.ok)throw new Error(data.error||text.error);setPreparedOrder(data.orderId||"");if(data.paymentUrl)setPaymentUrl(data.paymentUrl);else if(data.orderId)window.location.assign(`/orders/${data.orderId}?locale=${locale}`);
    }catch(err){setError(err instanceof Error?err.message:text.error);}finally{setBusy(false);preparingRef.current=false;}
  }
  async function saveContact(){const formEl=formRef.current;if(!formEl||!preparedOrder||!formEl.checkValidity())return;const form=new FormData(formEl);const rawBirth=String(form.get("birthDate")||"");const payload:any={idempotencyKey:orderKey(),firstName:String(form.get("firstName")||""),lastName:String(form.get("lastName")||""),email:String(form.get("email")||""),phone:String(form.get("phone")||""),birthDate:rawBirth?birthDateToIso(rawBirth):"",city:String(form.get("city")||""),facebook:String(form.get("facebook")||""),instagram:String(form.get("instagram")||""),eligibilityAnswer:hasOrganizerQuestion?String(form.get("eligibilityAnswer")||""):""};
    const response=await fetch(`/api/orders/${preparedOrder}/checkout-contact`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});if(!response.ok){const data=await response.json().catch(()=>({}));setError(data.error||text.saveError);return;}const demographics=await fetch(`/api/orders/${preparedOrder}/demographics`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idempotencyKey:orderKey(),gender:String(form.get("gender")||""),birthDate:rawBirth?birthDateToIso(rawBirth):""})});if(!demographics.ok){setError(text.saveError);return;}capture("CONTACTS_ENTERED",payload);setContactSaved(true);setError("");}
  function scheduleContactSave(){setContactSaved(false);if(contactTimerRef.current)clearTimeout(contactTimerRef.current);contactTimerRef.current=setTimeout(()=>void saveContact(),350);}
  async function applyPromo(){setBusy(true);await cancelPrepared();orderKeyRef.current=crypto.randomUUID();setPreparedOrder("");setPaymentUrl("");setContactSaved(false);await preparePayment(promo.trim().toUpperCase());setTimeout(()=>void saveContact(),50);}
  useEffect(()=>{capture("CHECKOUT_OPENED");void preparePayment();return()=>{if(contactTimerRef.current)clearTimeout(contactTimerRef.current);};},[]);

  return <form ref={formRef} onInput={scheduleContactSave} onChange={scheduleContactSave} onSubmit={e=>e.preventDefault()} className={styles.checkoutShell}>
    <main className={styles.mainColumn}>
      <section className={`panel ${styles.formCard}`}>
        <div className={styles.sectionHeading}><h1>{text.contact}</h1><p className="muted">{text.contactHelp}</p></div>
        {props.promoterLabel&&<div className={styles.fullWidth}><strong>{text.promoter}</strong><div className="muted">{props.promoterLabel}</div></div>}
        <div className={styles.contactGrid}>
          {visible.map(key=><div className={`field ${key==="birthDate"?styles.wideField:""}`} key={key}><label>{labels[key][locale]}{props.guestFields[key].required?" *":""}</label><input className="input" name={key} type={types[key]||"text"} required={props.guestFields[key].required} minLength={key==="firstName"||key==="lastName"?2:undefined} list={key==="city"?"israel-cities":undefined} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":key==="phone"?"tel":key==="email"?"email":key==="birthDate"?"bday":key==="city"?"address-level2":"off"} inputMode={key==="birthDate"?"numeric":undefined} maxLength={key==="birthDate"?10:undefined} pattern={key==="birthDate"?"\\d{2}\\.\\d{2}\\.\\d{4}":undefined} onInput={key==="birthDate"?handleBirthDateInput:undefined} placeholder={key==="phone"?"054-1234567":key==="instagram"?"@username":key==="birthDate"?(locale==="ru"?"ДД.ММ.ГГГГ":"DD.MM.YYYY"):undefined}/>{key==="city"&&<datalist id="israel-cities">{israelCities.map(city=><option value={city} key={city}/>)}</datalist>}</div>)}
          <div className="field"><label>{text.gender} *</label><select className="input" name="gender" required defaultValue=""><option value="" disabled>{text.chooseGender}</option><option value="MALE">{text.male}</option><option value="FEMALE">{text.female}</option></select></div>
          {hasOrganizerQuestion&&<div className={`field ${styles.fullWidth}`}><label>{props.approvalInstructions}</label><textarea name="eligibilityAnswer" rows={3} required placeholder={text.extraPlaceholder}/></div>}
        </div>
      </section>

      <section className={`panel ${styles.paymentCard}`}>
        <div className={styles.paymentHeader}><div><h2>{text.payment}</h2><span className={styles.secureLabel}>🔒 {text.secured}</span></div></div>
        {approvalRequired&&<div className={styles.approvalNote}>{text.review}</div>}
        <div className={`${styles.paymentStage} ${!contactSaved?styles.paymentLocked:""}`} aria-disabled={!contactSaved}>
          {paymentUrl?<iframe ref={iframeRef} src={paymentUrl} title={text.payment} onLoad={handlePaymentFrameLoad} allow="payment" className={styles.paymentFrame}/>:<div className={styles.paymentSkeleton}><div className={styles.walletSkeleton}/><div className={styles.walletSkeleton}/><div className={styles.cardSkeleton}/><span>{text.paymentLoading}</span></div>}
        </div>
        <div className={styles.securityLine}>🔒 {text.paymentHelp}</div>
        {error&&<div className="toast">{error}</div>}
      </section>
    </main>

    <aside className={styles.sideColumn}>
      <section className={`panel ${styles.summary}`}><span className="pill">{approvalRequired?text.requested:text.order}</span><h2>{props.title}</h2><p className="muted">{props.label}</p><hr className={styles.divider}/><div className="row between"><span className="muted">{text.quantity}</span><strong>{props.quantity}</strong></div><div className="row between"><span className="muted">{text.subtotal}</span><strong>{money(props.subtotal,"ILS",locale)}</strong></div><div className="row between"><span className="muted">{text.fee}</span><strong>{money(props.serviceFee,"ILS",locale)}</strong></div><hr className={styles.divider}/><div className={styles.totalRow}><strong>{approvalRequired?text.afterApproval:text.total}</strong><span className={styles.totalPrice}>{money(props.total,"ILS",locale)}</span></div></section>
      {!approvalRequired&&<section className={`panel ${styles.promoCard}`}><label>{text.promo}</label><div className={styles.promoRow}><input className="input" value={promo} onChange={e=>setPromo(e.target.value.toUpperCase())} placeholder={text.promoPlaceholder}/><button type="button" className="btn secondary" onClick={()=>void applyPromo()} disabled={busy}>{text.apply}</button></div></section>}
      <div className={styles.trustList}><div>⚡ <span>{approvalRequired?text.review:"Instant confirmation"}</span></div><div>🔒 <span>PCI DSS · HYP</span></div><div>🎫 <span>Atlas One</span></div></div>
    </aside>
  </form>;
}
