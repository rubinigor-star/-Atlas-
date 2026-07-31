"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultGuestFields, guestFieldKeys, type GuestFieldConfig, type GuestFieldKey } from "@/lib/event-guest-fields";
import styles from "./create-event-form.module.css";

type AdmissionMode = "GENERAL_ADMISSION" | "RESERVED_SEATING";
type PricingMode = "FIXED" | "SCHEDULED";
type TabId = "details" | "sales" | "checkout" | "review";

const fieldLabels:Record<GuestFieldKey,string>={firstName:"Имя",lastName:"Фамилия",phone:"Телефон",email:"Email",birthDate:"Дата рождения",city:"Город проживания",facebook:"Facebook",instagram:"Instagram"};
const tabs:Array<{id:TabId;label:string}>=[
  {id:"details",label:"О мероприятии"},
  {id:"sales",label:"Продажа"},
  {id:"checkout",label:"Оформление заказа"},
  {id:"review",label:"Проверка и запуск"},
];

export function CreateEventForm(){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [activeTab,setActiveTab]=useState<TabId>("details");
  const [invalidTabs,setInvalidTabs]=useState<TabId[]>([]);
  const [admissionMode,setAdmissionMode]=useState<AdmissionMode>("GENERAL_ADMISSION");
  const [pricingMode,setPricingMode]=useState<PricingMode>("FIXED");
  const [salesMode,setSalesMode]=useState<"INSTANT"|"APPROVAL_REQUIRED">("INSTANT");
  const [guestFields,setGuestFields]=useState<GuestFieldConfig>(defaultGuestFields);
  const activeIndex=tabs.findIndex(tab=>tab.id===activeTab);
  const progress=Math.round(((activeIndex+1)/tabs.length)*100);
  const activeLabel=useMemo(()=>tabs[activeIndex]?.label??"",[activeIndex]);

  function updateField(key:GuestFieldKey,part:"visible"|"required",value:boolean){
    setGuestFields(current=>({...current,[key]:{...current[key],[part]:value,...(part==="visible"&&!value?{required:false}:{})}}));
  }

  function validateForm(form:HTMLFormElement){
    const invalid=Array.from(form.elements).filter((element):element is HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement=>element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement).filter(element=>!element.checkValidity());
    const tabsWithErrors=Array.from(new Set(invalid.map(element=>element.closest<HTMLElement>("[data-tab]")?.dataset.tab).filter(Boolean))) as TabId[];
    setInvalidTabs(tabsWithErrors);
    if(!invalid.length)return true;
    const first=invalid[0];
    const tab=first.closest<HTMLElement>("[data-tab]")?.dataset.tab as TabId|undefined;
    if(tab)setActiveTab(tab);
    window.setTimeout(()=>{first.focus();first.reportValidity();},0);
    return false;
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!validateForm(event.currentTarget))return;
    setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    let posterUrl="/assets/noa-live-tel-aviv.png";
    const poster=form.get("poster");
    if(poster instanceof File&&poster.size){
      const upload=new FormData();upload.set("poster",poster);
      const uploadResponse=await fetch("/api/uploads",{method:"POST",body:upload});
      const uploadData=await uploadResponse.json();
      if(!uploadResponse.ok){setError(uploadData.error);setBusy(false);return;}
      posterUrl=uploadData.url;
    }
    const date=(name:string)=>new Date(String(form.get(name))).toISOString();
    const payload={title:form.get("title"),slug:form.get("slug"),description:form.get("description"),primaryLanguage:form.get("primaryLanguage"),catalogVisibility:form.get("catalogVisibility"),startsAt:date("startsAt"),doorsOpenAt:date("doorsOpenAt"),venueName:form.get("venueName"),city:form.get("city"),address:form.get("address"),mapEnabled:admissionMode==="RESERVED_SEATING",salesMode,...(salesMode==="APPROVAL_REQUIRED"?{approvalInstructions:String(form.get("approvalInstructions")||"")}:{}) ,posterUrl,categoryName:form.get("categoryName"),categoryDescription:form.get("categoryDescription"),categoryColor:form.get("categoryColor"),priceMinor:Math.round(Number(form.get("price"))*100),capacity:Number(form.get("capacity")),pricingMode,salesStart:date("salesStart"),salesEnd:date("salesEnd"),earlyBirdPriceMinor:pricingMode==="SCHEDULED"?Math.round(Number(form.get("earlyBirdPrice"))*100):undefined,earlyBirdEndsAt:pricingMode==="SCHEDULED"?date("earlyBirdEndsAt"):undefined,maxPerOrder:Number(form.get("maxPerOrder")),guestFields};
    const response=await fetch("/api/admin/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const data=await response.json();
    if(!response.ok){setError(data.error);setBusy(false);return;}
    router.push(`/office/events/${data.id}`);router.refresh();
  }

  function nextTab(){if(activeIndex<tabs.length-1)setActiveTab(tabs[activeIndex+1].id);}
  function previousTab(){if(activeIndex>0)setActiveTab(tabs[activeIndex-1].id);}

  return <form onSubmit={submit} noValidate className={`${styles.wizardShell} ${busy?"loading":""}`}>
    <nav className={styles.tabBar} aria-label="Этапы создания мероприятия">
      {tabs.map((tab,index)=><button key={tab.id} type="button" className={`${styles.tabButton} ${activeTab===tab.id?styles.tabButtonActive:""}`} onClick={()=>setActiveTab(tab.id)} aria-current={activeTab===tab.id?"step":undefined}>
        <span className={styles.tabIndex}>{String(index+1).padStart(2,"0")}</span><span>{tab.label}</span>{invalidTabs.includes(tab.id)&&<i className={styles.tabError} aria-label="Есть незаполненные обязательные поля"/>}
      </button>)}
    </nav>

    <div className={styles.contentGrid}>
      <div className={styles.panelViewport}>
        <section data-tab="details" className={`panel form wizard-section ${activeTab!=="details"?styles.tabPanelInactive:""}`}>
          <div className="wizard-heading"><span>01</span><div><h2>О мероприятии</h2><p>Что происходит, где, когда и кому это показывать.</p></div></div>
          <div className="field"><label>Название мероприятия</label><input className="input" name="title" required/></div>
          <div className="field"><label>Адрес страницы</label><input className="input" name="slug" pattern="[a-z0-9-]+" required placeholder="event-name-2026"/></div>
          <div className="field"><label>Описание</label><textarea name="description" rows={5} required minLength={20}/></div>
          <div className="form-grid two"><div className="field"><label>Основной язык мероприятия</label><select name="primaryLanguage" defaultValue="" required><option value="" disabled>Выберите язык</option><option value="RU">Русский</option><option value="HE">Иврит</option><option value="EN">Английский</option><option value="AR">Арабский</option><option value="MULTILINGUAL">Несколько языков</option><option value="NO_LANGUAGE_BARRIER">Без языкового барьера</option><option value="OTHER">Другой язык</option></select></div><div className="field"><label>Кому показывать в каталоге</label><select name="catalogVisibility" defaultValue="TARGETED" required><option value="TARGETED">Подходящей языковой аудитории</option><option value="PUBLIC">Всем пользователям</option><option value="DIRECT_ONLY">Только по прямой ссылке</option></select></div></div>
          <div className="field"><label>Афиша JPG, PNG или WebP — до 2 MB</label><input className="input" name="poster" type="file" accept="image/jpeg,image/png,image/webp"/></div>
          <div className="form-grid two"><div className="field"><label>Начало мероприятия</label><input className="input" name="startsAt" type="datetime-local" required/></div><div className="field"><label>Открытие дверей</label><input className="input" name="doorsOpenAt" type="datetime-local" required/></div></div>
          <div className="form-grid two"><div className="field"><label>Площадка</label><input className="input" name="venueName" required/></div><div className="field"><label>Город</label><input className="input" name="city" required/></div></div>
          <div className="field"><label>Адрес мероприятия</label><input className="input" name="address" required autoComplete="street-address"/></div>
        </section>

        <section data-tab="sales" className={`panel form wizard-section ${activeTab!=="sales"?styles.tabPanelInactive:""}`}>
          <div className="wizard-heading"><span>02</span><div><h2>Продажа</h2><p>Формат выбора, первый тип билета и базовые правила продаж.</p></div></div>
          <div className="choice-grid"><button type="button" className={`choice-card ${admissionMode==="GENERAL_ADMISSION"?"selected":""}`} onClick={()=>setAdmissionMode("GENERAL_ADMISSION")}><i>🎟</i><strong>Без схемы зала</strong><small>Выбор типа и количества билетов.</small></button><button type="button" className={`choice-card ${admissionMode==="RESERVED_SEATING"?"selected":""}`} onClick={()=>setAdmissionMode("RESERVED_SEATING")}><i>▦</i><strong>С выбором мест</strong><small>Столы, диваны, ряды и места.</small></button></div>
          <div className="form-grid three"><div className="field"><label>Название билета</label><input key={admissionMode} className="input" name="categoryName" defaultValue={admissionMode==="RESERVED_SEATING"?"VIP Seating":"General Admission"} required/></div><div className="field"><label>Количество</label><input className="input" name="capacity" type="number" min="1" required/></div><div className="field"><label>Цвет категории</label><input className="input color-input" name="categoryColor" type="color" defaultValue="#2563EB"/></div></div>
          <div className="field"><label>Что входит в билет</label><textarea name="categoryDescription" rows={2}/></div>
          <div className="field"><label>Цена, ₪</label><input className="input" name="price" type="number" min="0" step="0.01" required/></div>
          <details className={styles.optionalBox} open={pricingMode==="SCHEDULED"}><summary onClick={event=>{event.preventDefault();setPricingMode(pricingMode==="FIXED"?"SCHEDULED":"FIXED");}}>Дополнительная настройка цены</summary>{pricingMode==="SCHEDULED"&&<div className={styles.optionalContent}><p className="muted">Экспериментальный режим. Перед публикацией отдельно проверим отображение цены для покупателя.</p><div className="form-grid two"><div className="field"><label>Ранняя цена, ₪</label><input className="input" name="earlyBirdPrice" type="number" min="0" step="0.01" required/></div><div className="field"><label>Действует до</label><input className="input" name="earlyBirdEndsAt" type="datetime-local" required/></div></div></div>}</details>
          <div className="form-grid three"><div className="field"><label>Начало продаж</label><input className="input" name="salesStart" type="datetime-local" required/></div><div className="field"><label>Окончание продаж</label><input className="input" name="salesEnd" type="datetime-local" required/></div><div className="field"><label>Максимум в заказе</label><input className="input" name="maxPerOrder" type="number" min="1" max="20" defaultValue="10" required/></div></div>
        </section>

        <section data-tab="checkout" className={`panel form wizard-section ${activeTab!=="checkout"?styles.tabPanelInactive:""}`}>
          <div className="wizard-heading"><span>03</span><div><h2>Оформление заказа</h2><p>Что заполняет покупатель и когда он получает билет.</p></div></div>
          <label className="option"><span><strong>Билет сразу после оплаты</strong><small>Автоматическая выдача QR-билета.</small></span><input type="radio" checked={salesMode==="INSTANT"} onChange={()=>setSalesMode("INSTANT")}/></label>
          <label className="option"><span><strong>Продажа только после одобрения</strong><small>Сначала заявка, затем доступ к оплате.</small></span><input type="radio" checked={salesMode==="APPROVAL_REQUIRED"} onChange={()=>setSalesMode("APPROVAL_REQUIRED")}/></label>
          {salesMode==="APPROVAL_REQUIRED"&&<div className="field"><label>Инструкция покупателю</label><textarea name="approvalInstructions" rows={2} defaultValue="Укажите номер клубной карты или кто вас пригласил"/></div>}
          <details className={styles.optionalBox}><summary>Поля анкеты покупателя</summary><div className={styles.optionalContent}><div className="table-wrap"><table><thead><tr><th>Поле</th><th>Показывать</th><th>Обязательно</th></tr></thead><tbody>{guestFieldKeys.map(key=><tr key={key}><td><strong>{fieldLabels[key]}</strong></td><td><input type="checkbox" checked={guestFields[key].visible} disabled={key==="firstName"||key==="phone"} onChange={e=>updateField(key,"visible",e.target.checked)}/></td><td><input type="checkbox" checked={guestFields[key].required} disabled={!guestFields[key].visible||key==="firstName"||key==="phone"} onChange={e=>updateField(key,"required",e.target.checked)}/></td></tr>)}</tbody></table></div><p className="muted">Имя и телефон всегда обязательны.</p></div></details>
        </section>

        <section data-tab="review" className={`panel form wizard-section ${activeTab!=="review"?styles.tabPanelInactive:""}`}>
          <div className="wizard-heading"><span>04</span><div><h2>Проверка и запуск</h2><p>Atlas проверит обязательные поля и создаст черновик мероприятия.</p></div></div>
          <div className={styles.reviewGrid}><div className={styles.reviewCard}><h3>Формат продажи</h3><p>{admissionMode==="RESERVED_SEATING"?"После создания откроется настройка схемы зала.":"Покупатель выбирает тип и количество билетов."}</p></div><div className={styles.reviewCard}><h3>Цена</h3><p>{pricingMode==="SCHEDULED"?"Настроена ранняя и основная цена. Отображение обязательно проверим в Preview.":"Используется обычная фиксированная цена."}</p></div><div className={styles.reviewCard}><h3>Выдача</h3><p>{salesMode==="APPROVAL_REQUIRED"?"Покупатель сначала отправляет заявку.":"Билет выдаётся автоматически после оплаты."}</p></div><div className={styles.reviewCard}><h3>Следующий шаг</h3><p>После создания откроется единое рабочее пространство мероприятия: редактор, схема, дизайн билета, каналы и гостевые списки.</p></div></div>
        </section>
      </div>

      <aside className={`panel ${styles.summary}`}><div><span className="eyebrow">Редактор мероприятия</span><h3>{activeLabel}</h3></div><div className={styles.summaryList}><div className={styles.summaryItem}><span>Формат</span><strong>{admissionMode==="RESERVED_SEATING"?"С выбором мест":"Без схемы зала"}</strong></div><div className={styles.summaryItem}><span>Цена</span><strong>{pricingMode==="SCHEDULED"?"С изменением по времени":"Фиксированная"}</strong></div><div className={styles.summaryItem}><span>Выдача</span><strong>{salesMode==="APPROVAL_REQUIRED"?"После одобрения":"После оплаты"}</strong></div></div><div><div className="row between"><small className="muted">Готовность</small><strong>{progress}%</strong></div><div className={styles.progressTrack}><div className={styles.progressValue} style={{width:`${progress}%`}}/></div><small className="muted">Раздел {activeIndex+1} из {tabs.length}</small></div></aside>
    </div>

    {error&&<div className="toast">{error}</div>}
    <div className={styles.footerNav}><button type="button" className={styles.secondaryButton} onClick={previousTab} disabled={activeIndex===0}>Назад</button><div className={styles.footerActions}>{activeIndex<tabs.length-1?<button type="button" className="btn" onClick={nextTab}>Далее</button>:<button className="btn" disabled={busy}>{busy?"Создаём...":"Создать черновик"}</button>}</div></div>
  </form>;
}
