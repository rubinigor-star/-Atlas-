"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { israelCities } from "@/lib/israel-cities";
import type { GuestFieldConfig, GuestFieldKey } from "@/lib/event-guest-fields";

type PaymentMethod = "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "PAYPAL";

const copy={ru:{request:"Заявка на билет",checkout:"Checkout",reviewData:"Данные для рассмотрения",contact:"Данные гостя",firstName:"Имя",lastName:"Фамилия",birthDate:"Дата рождения",city:"Город проживания",phone:"Телефон",promo:"Промокод",extra:"Дополнительная информация для организатора",extraPlaceholder:"Например, номер клубной карты или кто вас пригласил",promoPlaceholder:"Например, ATLAS10",reviewFirst:"Сначала проверка организатором",testPayment:"Тестовая оплата",reviewHelp:"Оплата будет авторизована сейчас, но не списана. После одобрения организатора система завершит тестовую оплату и выпустит билет.",paymentHelp:"Это безопасная симуляция. Реальные деньги не списываются.",sending:"Отправляем...",send:"Авторизовать оплату и отправить заявку",confirm:"Оплатить тестово и получить билет",requested:"Запрашиваемый билет",order:"Ваш заказ",quantity:"Количество",afterApproval:"Будет списано после одобрения",total:"Итого",error:"Не удалось отправить данные",promoter:"Персональная ссылка",paymentTitle:"Способ оплаты",card:"Банковская карта",apple:"Apple Pay",google:"Google Pay",paypal:"PayPal",cardNumber:"Номер карты",cardholder:"Имя владельца",expiry:"Срок действия",cvc:"CVC",testCards:"Успех: 4242 4242 4242 4242 · Отказ: 4000 0000 0000 0002"},he:{request:"בקשה לכרטיס",checkout:"תשלום",reviewData:"פרטים לבדיקת המפיק",contact:"פרטי האורח",firstName:"שם פרטי",lastName:"שם משפחה",birthDate:"תאריך לידה",city:"עיר מגורים",phone:"טלפון",promo:"קוד הטבה",extra:"מידע נוסף למפיק",extraPlaceholder:"לדוגמה, מספר כרטיס מועדון או מי הזמין אתכם",promoPlaceholder:"לדוגמה, ATLAS10",reviewFirst:"תחילה בדיקת המפיק",testPayment:"תשלום ניסיון",reviewHelp:"התשלום יאושר כעת אך לא יחויב. לאחר אישור המפיק המערכת תשלים את תשלום הניסיון ותנפיק כרטיס.",paymentHelp:"זוהי סימולציה בטוחה. לא מתבצע חיוב אמיתי.",sending:"שולח...",send:"אישור תשלום ושליחת בקשה",confirm:"תשלום ניסיון וקבלת כרטיס",requested:"הכרטיס המבוקש",order:"ההזמנה שלך",quantity:"כמות",afterApproval:"יחויב לאחר אישור",total:"סה״כ",error:"לא ניתן לשלוח את הנתונים",promoter:"קישור אישי",paymentTitle:"אמצעי תשלום",card:"כרטיס אשראי",apple:"Apple Pay",google:"Google Pay",paypal:"PayPal",cardNumber:"מספר כרטיס",cardholder:"שם בעל הכרטיס",expiry:"תוקף",cvc:"CVC",testCards:"הצלחה: 4242 4242 4242 4242 · דחייה: 4000 0000 0000 0002"}};
const labels:Record<GuestFieldKey,{ru:string;he:string}>={firstName:{ru:"Имя",he:"שם פרטי"},lastName:{ru:"Фамилия",he:"שם משפחה"},phone:{ru:"Телефон",he:"טלפון"},email:{ru:"Email",he:"Email"},birthDate:{ru:"Дата рождения",he:"תאריך לידה"},city:{ru:"Город проживания",he:"עיר מגורים"},facebook:{ru:"Facebook",he:"Facebook"},instagram:{ru:"Instagram",he:"Instagram"}};
const types:Partial<Record<GuestFieldKey,string>>={phone:"tel",email:"email",birthDate:"date"};
type CheckoutFormProps={eventId:string;categoryId:string;quantity:number;tableId?:string;seatIds?:string[];total:number;title:string;label:string;salesMode:"INSTANT"|"APPROVAL_REQUIRED";approvalInstructions?:string|null;referralCode?:string;promoterLabel?:string;guestFields:GuestFieldConfig};

export function CheckoutForm(props:CheckoutFormProps){
  const router=useRouter();
  const {locale}=useLocale();
  const text=copy[locale];
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [promo,setPromo]=useState("");
  const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>("CARD");
  const [cardNumber,setCardNumber]=useState("4242 4242 4242 4242");
  const [cardholderName,setCardholderName]=useState("Test Customer");
  const [expiry,setExpiry]=useState("12/30");
  const [cvc,setCvc]=useState("123");
  const approvalRequired=props.salesMode==="APPROVAL_REQUIRED";
  const visible=(Object.keys(props.guestFields) as GuestFieldKey[]).filter(key=>props.guestFields[key].visible);
  const payment=paymentMethod==="CARD"?{method:paymentMethod,cardNumber,cardholderName,expiry,cvc}:{method:paymentMethod};

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    const customer=Object.fromEntries(visible.map(key=>[key,String(form.get(key)||"")]));
    const response=await fetch("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:props.eventId,categoryId:props.categoryId,quantity:props.quantity,tableId:props.tableId||null,seatIds:props.seatIds||undefined,promoCode:promo||undefined,referralCode:props.referralCode||undefined,eligibilityAnswer:form.get("eligibilityAnswer")||undefined,customer,payment,idempotencyKey:crypto.randomUUID()})});
    const data=await response.json();
    if(!response.ok){setError(data.error||text.error);setBusy(false);return;}
    router.push(`/orders/${data.orderId}`);
  }

  return <form onSubmit={submit} className={`checkout ${busy?"loading":""}`}><section><span className="eyebrow">{approvalRequired?text.request:text.checkout}</span><h1>{approvalRequired?text.reviewData:text.contact}</h1><div className="panel form">{props.promoterLabel&&<div className="panel" style={{background:"#f8fafc"}}><strong>{text.promoter}</strong><p className="muted">{props.promoterLabel}</p></div>}{visible.map(key=><div className="field" key={key}><label>{labels[key][locale]}{props.guestFields[key].required?" *":""}</label><input className="input" name={key} type={types[key]||"text"} required={props.guestFields[key].required} minLength={key==="firstName"||key==="lastName"?2:undefined} list={key==="city"?"israel-cities":undefined} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":key==="phone"?"tel":key==="email"?"email":key==="birthDate"?"bday":key==="city"?"address-level2":"off"} max={key==="birthDate"?new Date().toISOString().slice(0,10):undefined} placeholder={key==="phone"?"054-1234567":key==="instagram"?"@username":undefined}/>{key==="city"&&<datalist id="israel-cities">{israelCities.map(city=><option value={city} key={city}/>)}</datalist>}</div>)}{approvalRequired&&<div className="field"><label>{props.approvalInstructions||text.extra}</label><textarea name="eligibilityAnswer" rows={4} required placeholder={text.extraPlaceholder}/></div>}{!approvalRequired&&<div className="field"><label>{text.promo}</label><input className="input" value={promo} onChange={event=>setPromo(event.target.value.toUpperCase())} placeholder={text.promoPlaceholder}/></div>}

  <div className="panel" style={{background:"#f8fafc"}}><strong>{text.paymentTitle}</strong><p className="muted">{approvalRequired?text.reviewHelp:text.paymentHelp}</p><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,margin:"14px 0"}}>{([['CARD',text.card],['APPLE_PAY',text.apple],['GOOGLE_PAY',text.google],['PAYPAL',text.paypal]] as [PaymentMethod,string][]).map(([id,label])=><button key={id} type="button" className={paymentMethod===id?"btn dark":"btn"} onClick={()=>setPaymentMethod(id)}>{label}</button>)}</div>{paymentMethod==="CARD"&&<div style={{display:"grid",gap:10}}><div className="field"><label>{text.cardNumber}</label><input className="input" value={cardNumber} onChange={event=>setCardNumber(event.target.value)} inputMode="numeric" autoComplete="cc-number" required/></div><div className="field"><label>{text.cardholder}</label><input className="input" value={cardholderName} onChange={event=>setCardholderName(event.target.value)} autoComplete="cc-name" required/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div className="field"><label>{text.expiry}</label><input className="input" value={expiry} onChange={event=>setExpiry(event.target.value)} placeholder="MM/YY" autoComplete="cc-exp" required/></div><div className="field"><label>{text.cvc}</label><input className="input" value={cvc} onChange={event=>setCvc(event.target.value)} inputMode="numeric" autoComplete="cc-csc" required/></div></div><div className="muted" style={{fontSize:13}}>{text.testCards}</div></div>}</div>

  {error&&<div className="toast">{error}</div>}<button className="btn dark" disabled={busy}>{busy?text.sending:approvalRequired?text.send:text.confirm}</button></div></section><aside className="panel summary"><span className="pill">{approvalRequired?text.requested:text.order}</span><h2>{props.title}</h2><p>{props.label}</p><div className="row between"><span className="muted">{text.quantity}</span><strong>{props.quantity}</strong></div><hr style={{border:0,borderTop:"1px solid #e5e7eb",margin:"18px 0"}}/><div className="row between"><strong>{approvalRequired?text.afterApproval:text.total}</strong><strong style={{fontSize:25}}>{money(props.total)}</strong></div></aside></form>;
}
