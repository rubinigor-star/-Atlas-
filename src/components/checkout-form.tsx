"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { israelCities } from "@/lib/israel-cities";
import type { GuestFieldConfig, GuestFieldKey } from "@/lib/event-guest-fields";
import type { Locale } from "@/lib/i18n";

const copy={
 ru:{request:"Заявка на билет",checkout:"Оформление заказа",reviewData:"Данные для заявки",contact:"Данные гостя",promo:"Промокод",extra:"Дополнительная информация для организатора",extraPlaceholder:"Например, номер клубной карты или кто вас пригласил",promoPlaceholder:"Например, ATLAS10",reviewFirst:"Сначала авторизация карты, затем решение организатора",payment:"Безопасная оплата",reviewHelp:"После заполнения данных вы перейдёте на защищённую страницу HYP и введёте карту. Сумма будет только предварительно авторизована. Деньги не будут списаны до подтверждения заказа организатором.",paymentHelp:"После оформления заказа вы перейдёте на защищённую страницу Hyp. Atlas не получает и не хранит данные банковской карты.",sending:"Подготавливаем безопасную оплату…",send:"Перейти к авторизации карты",confirm:"Перейти к безопасной оплате",requested:"Запрашиваемый билет",order:"Ваш заказ",quantity:"Количество",afterApproval:"Будет списано после одобрения",total:"Итого к оплате",error:"Не удалось отправить данные",promoter:"Персональная ссылка"},
 he:{request:"בקשה לכרטיס",checkout:"תשלום",reviewData:"פרטי הבקשה",contact:"פרטי האורח",promo:"קוד הטבה",extra:"מידע נוסף למפיק",extraPlaceholder:"לדוגמה, מספר כרטיס מועדון או מי הזמין אתכם",promoPlaceholder:"לדוגמה, ATLAS10",reviewFirst:"תחילה אישור מסגרת בכרטיס ולאחר מכן החלטת המפיק",payment:"תשלום מאובטח",reviewHelp:"לאחר מילוי הפרטים תעברו לעמוד המאובטח של HYP ותזינו כרטיס. הסכום יאושר מראש בלבד ולא יחויב עד שהמפיק יאשר את ההזמנה.",paymentHelp:"לאחר יצירת ההזמנה תועברו לעמוד התשלום המאובטח של Hyp. פרטי כרטיס האשראי אינם נשמרים ב-Atlas.",sending:"מכינים את האישור המאובטח…",send:"מעבר לאישור הכרטיס",confirm:"מעבר לתשלום מאובטח",requested:"הכרטיס המבוקש",order:"ההזמנה שלך",quantity:"כמות",afterApproval:"יחויב לאחר אישור",total:"סה״כ לתשלום",error:"לא ניתן לשלוח את הנתונים",promoter:"קישור אישי"},
 en:{request:"Ticket request",checkout:"Checkout",reviewData:"Request details",contact:"Guest details",promo:"Promo code",extra:"Additional information for the organizer",extraPlaceholder:"For example, membership number or who invited you",promoPlaceholder:"For example, ATLAS10",reviewFirst:"Card authorization first, organizer decision second",payment:"Secure payment",reviewHelp:"After entering your details you will continue to HYP and enter your card. The amount will only be pre-authorized and will not be charged until the organizer approves the order.",paymentHelp:"After creating the order, you will be redirected to Hyp’s secure payment page. Atlas never receives or stores card details.",sending:"Preparing secure authorization…",send:"Continue to card authorization",confirm:"Continue to secure payment",requested:"Requested ticket",order:"Your order",quantity:"Quantity",afterApproval:"Charged after approval",total:"Total to pay",error:"Could not submit the details",promoter:"Personal link"}
};
const labels:Record<GuestFieldKey,Record<Locale,string>>={firstName:{ru:"Имя",he:"שם פרטי",en:"First name"},lastName:{ru:"Фамилия",he:"שם משפחה",en:"Last name"},phone:{ru:"Телефон",he:"טלפון",en:"Phone"},email:{ru:"Email",he:"Email",en:"Email"},birthDate:{ru:"Дата рождения",he:"תאריך לידה",en:"Date of birth"},city:{ru:"Город проживания",he:"עיר מגורים",en:"City"},facebook:{ru:"Facebook",he:"Facebook",en:"Facebook"},instagram:{ru:"Instagram",he:"Instagram",en:"Instagram"}};
const types:Partial<Record<GuestFieldKey,string>>={phone:"tel",email:"email",birthDate:"date"};
type CheckoutFormProps={eventId:string;categoryId:string;quantity:number;tableId?:string;seatIds?:string[];subtotal:number;serviceFee:number;total:number;serviceFeePayer:"BUYER"|"ORGANIZER";title:string;label:string;salesMode:"INSTANT"|"APPROVAL_REQUIRED";approvalInstructions?:string|null;referralCode?:string;promoterLabel?:string;guestFields:GuestFieldConfig};
type RecoveryCustomer={firstName?:string;lastName?:string;email?:string;phone?:string};

export function CheckoutForm(props:CheckoutFormProps){
 const router=useRouter();const{locale}=useLocale();const text=copy[locale];const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[promo,setPromo]=useState("");const approvalRequired=props.salesMode==="APPROVAL_REQUIRED";const visible=(Object.keys(props.guestFields) as GuestFieldKey[]).filter(key=>props.guestFields[key].visible);const tokenRef=useRef<string>("");const idempotencyRef=useRef<string>("");const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);const formRef=useRef<HTMLFormElement|null>(null);

 function checkoutIdentityKey(){return `atlas-checkout-idempotency-${props.eventId}-${props.categoryId}-${props.tableId||props.seatIds?.join("-")||"general"}`;}
 function idempotencyKey(){
  if(idempotencyRef.current)return idempotencyRef.current;
  const storageKey=checkoutIdentityKey();
  const existing=sessionStorage.getItem(storageKey);
  const value=existing||crypto.randomUUID();
  sessionStorage.setItem(storageKey,value);
  idempotencyRef.current=value;
  return value;
 }
 function token(){
  if(tokenRef.current)return tokenRef.current;
  const key=`atlas-abandon-${props.eventId}-${props.categoryId}-${props.tableId||props.seatIds?.join("-")||"general"}`;
  const existing=sessionStorage.getItem(key);const value=existing||crypto.randomUUID();sessionStorage.setItem(key,value);tokenRef.current=value;return value;
 }
 function customerFromForm():RecoveryCustomer{
  if(!formRef.current)return {};
  const form=new FormData(formRef.current);
  return {firstName:String(form.get("firstName")||""),lastName:String(form.get("lastName")||""),email:String(form.get("email")||""),phone:String(form.get("phone")||"")};
 }
 function capture(stage:"CHECKOUT_OPENED"|"CONTACTS_ENTERED"|"PAYMENT_STARTED",customer:RecoveryCustomer={}){
  const payload={token:token(),eventId:props.eventId,categoryId:props.categoryId,quantity:props.quantity,amountMinor:props.total,stage,checkoutUrl:window.location.href,customer,metadata:{tableId:props.tableId||null,seatIds:props.seatIds||[],label:props.label,referralCode:props.referralCode||null}};
  void fetch("/api/checkout/abandon",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),keepalive:true}).catch(()=>undefined);
 }
 function scheduleContactCapture(){if(timerRef.current)clearTimeout(timerRef.current);timerRef.current=setTimeout(()=>{const customer=customerFromForm();if(customer.email||customer.phone)capture("CONTACTS_ENTERED",customer);},700);}
 useEffect(()=>{void idempotencyKey();capture("CHECKOUT_OPENED");return()=>{if(timerRef.current)clearTimeout(timerRef.current);};},[]);

 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError("");
  const form=new FormData(event.currentTarget);const customer=Object.fromEntries(visible.map(key=>[key,String(form.get(key)||"")]));
  capture("PAYMENT_STARTED",customer);
  const response=await fetch("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:props.eventId,categoryId:props.categoryId,quantity:props.quantity,tableId:props.tableId||null,seatIds:props.seatIds||undefined,promoCode:promo||undefined,referralCode:props.referralCode||undefined,eligibilityAnswer:form.get("eligibilityAnswer")||undefined,customer,payment:{method:"CARD"},locale,idempotencyKey:idempotencyKey(),abandonToken:token()})});
  const data=await response.json();
  if(!response.ok){setError(data.error||text.error);setBusy(false);return;}
  if(data.paymentUrl){window.location.assign(data.paymentUrl);return;}
  router.push(`/orders/${data.orderId}?locale=${locale}`);
 }
 return <form ref={formRef} onInput={scheduleContactCapture} onSubmit={submit} className={`checkout ${busy?"loading":""}`}><section><span className="eyebrow">{approvalRequired?text.request:text.checkout}</span><h1>{approvalRequired?text.reviewData:text.contact}</h1><div className="panel form">{props.promoterLabel&&<div className="panel" style={{background:"#f8fafc"}}><strong>{text.promoter}</strong><p className="muted">{props.promoterLabel}</p></div>}{visible.map(key=><div className="field" key={key}><label>{labels[key][locale]}{props.guestFields[key].required?" *":""}</label><input className="input" name={key} type={types[key]||"text"} required={props.guestFields[key].required} minLength={key==="firstName"||key==="lastName"?2:undefined} list={key==="city"?"israel-cities":undefined} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":key==="phone"?"tel":key==="email"?"email":key==="birthDate"?"bday":key==="city"?"address-level2":"off"} max={key==="birthDate"?new Date().toISOString().slice(0,10):undefined} placeholder={key==="phone"?"054-1234567":key==="instagram"?"@username":undefined}/>{key==="city"&&<datalist id="israel-cities">{israelCities.map(city=><option value={city} key={city}/>)}</datalist>}</div>)}{approvalRequired&&<div className="field"><label>{props.approvalInstructions||text.extra}</label><textarea name="eligibilityAnswer" rows={4} required placeholder={text.extraPlaceholder}/></div>}{!approvalRequired&&<div className="field"><label>{text.promo}</label><input className="input" value={promo} onChange={event=>setPromo(event.target.value.toUpperCase())} placeholder={text.promoPlaceholder}/></div>}<div className="panel" style={{background:"#f8fafc"}}><strong>{approvalRequired?text.reviewFirst:text.payment}</strong><p className="muted" style={{marginBottom:0}}>{approvalRequired?text.reviewHelp:text.paymentHelp}</p></div>{error&&<div className="toast">{error}</div>}<button className="btn dark" disabled={busy}>{busy?text.sending:approvalRequired?text.send:text.confirm}</button></div></section><aside className="panel summary"><span className="pill">{approvalRequired?text.requested:text.order}</span><h2>{props.title}</h2><p>{props.label}</p><div className="row between"><span className="muted">{text.quantity}</span><strong>{props.quantity}</strong></div><hr style={{border:0,borderTop:"1px solid #e5e7eb",margin:"18px 0"}}/><div className="row between"><strong>{approvalRequired?text.afterApproval:text.total}</strong><strong style={{fontSize:25}}>{money(props.total,"ILS",locale)}</strong></div></aside></form>;
}
