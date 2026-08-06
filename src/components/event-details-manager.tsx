"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, MapPin, ShieldCheck, Theater } from "lucide-react";
import { PosterUploader } from "@/components/poster-uploader";
import { EventGalleryUploader } from "@/components/event-gallery-uploader";
import { EventVideoUploader } from "@/components/event-video-uploader";
import { EventFaqEditor } from "@/components/event-faq-editor";
import { useLocale } from "@/components/locale-provider";
import type { EventFaqItem } from "@/lib/event-presentation";
import { israelCities } from "@/lib/israel-cities";
import { ageRestrictionOptions, findVenue, getAgeRestrictionDescription, hebrewLetters, venueCatalog } from "@/lib/event-info-options";
import styles from "@/components/event-media-manager.module.css";

type MediaItem = { type: "VIDEO" | "LINK"; url: string; title?: string };
type Presentation = {
  shortDescription: string;
  ageRestriction: string;
  doorsOpenTime: string;
  galleryEnabled: boolean;
  galleryUrls: string[];
  faqEnabled: boolean;
  faq: EventFaqItem[];
};
type EventDetails = {
  id: string; title: string; description: string; shortDescription?: string; posterUrl: string;
  media: MediaItem[]; startsAt: string; venueName: string; city: string; address: string;
};

const TITLE_LIMIT = 50;
const SHORT_DESCRIPTION_LIMIT = 100;
const MAX_FAQ_ITEMS = 15;
const MIN_FAQ_ITEMS = 3;
const EMPTY_FAQ_ITEM: EventFaqItem = { question: "", answer: "" };
const PRESENTATION_MARKER = /<!--ATLAS_EVENT_PRESENTATION:([A-Za-z0-9+/=]+)-->/;

const labels = {
  ru: { title:"Официальное название мероприятия", titleHelp:"Максимум 50 символов.", shortDescription:"Краткое описание", shortHelp:"Показывается под названием мероприятия. Максимум 100 символов.", publicPanel:"Информационная панель страницы мероприятия", publicPanelHelp:"Выберите дату, город, зал и возрастное ограничение. Адрес и город синхронизируются с выбранным залом.", date:"Дата", start:"Начало", doors:"Открытие дверей", city:"Город", venue:"Зал", age:"Возраст", address:"Полный адрес", ageInfo:"Автоматическое пояснение для посетителя", media:"Медиафайлы мероприятия", posterTitle:"Главная афиша", posterHelp:"Обязательный квадрат 750 × 750 px. JPG, PNG или WebP. Исходный файл до 15 МБ.", galleryTitle:"Галерея", galleryToggle:"Добавить галерею", galleryHelp:"До 6 фотографий, не больше 1 МБ каждая.", galleryDisabled:"Поставьте галочку, чтобы открыть загрузку фотографий.", videoTitle:"Видео", videoToggle:"Добавить видео", videoHelp:"MP4 или WebM до 50 МБ, либо ссылка YouTube/Vimeo.", videoDisabled:"Поставьте галочку, чтобы добавить видео.", videoLink:"Ссылка YouTube или Vimeo", description:"Полное описание", links:"Дополнительные ссылки", faqToggle:"Добавить FAQ на страницу мероприятия", faqHelp:"До 15 пар вопрос-ответ. Пустые строки не публикуются.", faqQuestion:"Вопрос", faqAnswer:"Ответ", faqDuplicate:"Дублировать", faqInsert:"Добавить ниже", faqDelete:"Удалить", faqDrag:"Изменить порядок", faqAppend:"Добавить вопрос", faqLimit:"Максимум 15 вопросов", save:"Сохранить все изменения", saved:"Изменения сохранены", error:"Не удалось сохранить изменения", chars:"символов", allLetters:"Все", customVenue:"Для другого зала город и адрес вводятся вручную." },
  he: { title:"השם הרשמי של האירוע", titleHelp:"עד 50 תווים.", shortDescription:"תיאור קצר", shortHelp:"מופיע מתחת לשם האירוע. עד 100 תווים.", publicPanel:"סרגל המידע בעמוד האירוע", publicPanelHelp:"בחרו תאריך, עיר, אולם והגבלת גיל. העיר והכתובת מסתנכרנות עם האולם.", date:"תאריך", start:"תחילת האירוע", doors:"פתיחת דלתות", city:"עיר", venue:"אולם", age:"הגבלת גיל", address:"כתובת מלאה", ageInfo:"הסבר אוטומטי למבקר", media:"מדיה לאירוע", posterTitle:"כרזה ראשית", posterHelp:"ריבוע חובה 750 × 750 פיקסלים. JPG, PNG או WebP עד 15MB.", galleryTitle:"גלריה", galleryToggle:"הוספת גלריה", galleryHelp:"עד 6 תמונות, עד 1MB לכל תמונה.", galleryDisabled:"סמנו כדי לפתוח את העלאת התמונות.", videoTitle:"וידאו", videoToggle:"הוספת וידאו", videoHelp:"MP4 או WebM עד 50MB, או קישור YouTube/Vimeo.", videoDisabled:"סמנו כדי להוסיף וידאו.", videoLink:"קישור YouTube או Vimeo", description:"תיאור מלא", links:"קישורים נוספים", faqToggle:"הוספת FAQ לעמוד האירוע", faqHelp:"עד 15 שאלות ותשובות.", faqQuestion:"שאלה", faqAnswer:"תשובה", faqDuplicate:"שכפול", faqInsert:"הוספה מתחת", faqDelete:"מחיקה", faqDrag:"שינוי סדר", faqAppend:"הוספת שאלה", faqLimit:"מקסימום 15 שאלות", save:"שמירת כל השינויים", saved:"השינויים נשמרו", error:"לא ניתן לשמור", chars:"תווים", allLetters:"הכול", customVenue:"באולם אחר יש להזין עיר וכתובת ידנית." },
  en: { title:"Official event name", titleHelp:"Maximum 50 characters.", shortDescription:"Short description", shortHelp:"Shown below the event name. Maximum 100 characters.", publicPanel:"Event page information bar", publicPanelHelp:"Choose the date, city, venue and age restriction. City and address synchronize with the venue.", date:"Date", start:"Event start", doors:"Doors open", city:"City", venue:"Venue", age:"Age restriction", address:"Full address", ageInfo:"Automatic visitor notice", media:"Event media", posterTitle:"Main poster", posterHelp:"Required square 750 × 750 px. JPG, PNG or WebP up to 15 MB.", galleryTitle:"Gallery", galleryToggle:"Add gallery", galleryHelp:"Up to 6 photos, maximum 1 MB each.", galleryDisabled:"Select to open photo uploads.", videoTitle:"Video", videoToggle:"Add video", videoHelp:"MP4 or WebM up to 50 MB, or YouTube/Vimeo URL.", videoDisabled:"Select to add video.", videoLink:"YouTube or Vimeo URL", description:"Full description", links:"Additional links", faqToggle:"Add FAQ to the event page", faqHelp:"Up to 15 question-answer pairs.", faqQuestion:"Question", faqAnswer:"Answer", faqDuplicate:"Duplicate", faqInsert:"Add below", faqDelete:"Delete", faqDrag:"Reorder", faqAppend:"Add question", faqLimit:"Maximum 15 questions", save:"Save all changes", saved:"Changes saved", error:"Could not save changes", chars:"characters", allLetters:"All", customVenue:"For another venue, enter the city and address manually." },
} as const;

function normalizeFaq(value: unknown): EventFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_FAQ_ITEMS).map((item) => ({ question: typeof item?.question === "string" ? item.question.slice(0,180) : "", answer: typeof item?.answer === "string" ? item.answer.slice(0,1200) : "" }));
}
function ensureMinimumFaq(items: EventFaqItem[]) { const next=items.slice(0,MAX_FAQ_ITEMS).map(i=>({...i})); while(next.length<MIN_FAQ_ITEMS) next.push({...EMPTY_FAQ_ITEM}); return next; }
function emptyPresentation(): Presentation { return { shortDescription:"", ageRestriction:"Без ограничений", doorsOpenTime:"", galleryEnabled:false, galleryUrls:[], faqEnabled:false, faq:[] }; }
function decodePresentation(description:string):Presentation {
  const encoded=description.match(PRESENTATION_MARKER)?.[1]; if(!encoded||typeof window==="undefined") return emptyPresentation();
  try { const bytes=Uint8Array.from(window.atob(encoded),c=>c.charCodeAt(0)); const p=JSON.parse(new TextDecoder().decode(bytes)); const galleryUrls=Array.isArray(p?.galleryUrls)?p.galleryUrls.filter((u:unknown):u is string=>typeof u==="string"&&/^(?:https?:\/\/|data:image\/)/i.test(u)).slice(0,6):[]; const faq=normalizeFaq(p?.faq); return { shortDescription:typeof p?.shortDescription==="string"?p.shortDescription.slice(0,SHORT_DESCRIPTION_LIMIT):"", ageRestriction:ageRestrictionOptions.includes(p?.ageRestriction)?p.ageRestriction:"Без ограничений", doorsOpenTime:typeof p?.doorsOpenTime==="string"&&/^\d{2}:\d{2}$/.test(p.doorsOpenTime)?p.doorsOpenTime:"", galleryEnabled:p?.galleryEnabled===true&&galleryUrls.length>0, galleryUrls, faqEnabled:typeof p?.faqEnabled==="boolean"?p.faqEnabled:faq.length>0, faq }; } catch { return emptyPresentation(); }
}
function encodePresentation(value:Presentation) {
  const faq=value.faq.map(i=>({question:i.question.trim().slice(0,180),answer:i.answer.trim().slice(0,1200)})).filter(i=>i.question||i.answer).slice(0,MAX_FAQ_ITEMS);
  const normalized={...value,shortDescription:value.shortDescription.trim().slice(0,SHORT_DESCRIPTION_LIMIT),ageRestriction:ageRestrictionOptions.includes(value.ageRestriction as never)?value.ageRestriction:"Без ограничений",galleryEnabled:value.galleryEnabled&&value.galleryUrls.length>0,galleryUrls:value.galleryUrls.slice(0,6),faqEnabled:value.faqEnabled&&faq.some(i=>i.question&&i.answer),faq};
  const bytes=new TextEncoder().encode(JSON.stringify(normalized)); let binary=""; for(const byte of bytes) binary+=String.fromCharCode(byte); return `<!--ATLAS_EVENT_PRESENTATION:${window.btoa(binary)}-->`;
}

export function EventDetailsManager({event}:{event:EventDetails}) {
  const router=useRouter(); const {locale}=useLocale(); const text=labels[locale];
  const initialPresentation=useMemo(()=>decodePresentation(event.description),[event.description]);
  const cleanDescription=useMemo(()=>event.description.replace(PRESENTATION_MARKER,"").trim(),[event.description]);
  const initialVideoUrl=event.media.find(i=>i.type==="VIDEO")?.url||"";
  const initialVenue=findVenue(event.venueName);
  const [message,setMessage]=useState(""); const [title,setTitle]=useState(event.title.slice(0,TITLE_LIMIT)); const [shortDescription,setShortDescription]=useState((event.shortDescription||initialPresentation.shortDescription).slice(0,SHORT_DESCRIPTION_LIMIT));
  const [ageRestriction,setAgeRestriction]=useState(initialPresentation.ageRestriction); const [doorsOpenTime,setDoorsOpenTime]=useState(initialPresentation.doorsOpenTime); const [startTime,setStartTime]=useState(event.startsAt.slice(11,16)||"12:00");
  const [city,setCity]=useState(initialVenue?.city||event.city); const [venueName,setVenueName]=useState(event.venueName); const [address,setAddress]=useState(initialVenue?.address||event.address); const [venueLetter,setVenueLetter]=useState("");
  const [videoEnabled,setVideoEnabled]=useState(Boolean(initialVideoUrl)); const [videoUrl,setVideoUrl]=useState(initialVideoUrl); const [galleryEnabled,setGalleryEnabled]=useState(initialPresentation.galleryEnabled); const [galleryUrls,setGalleryUrls]=useState(initialPresentation.galleryUrls); const [faqEnabled,setFaqEnabled]=useState(initialPresentation.faqEnabled); const [faq,setFaq]=useState<EventFaqItem[]>(initialPresentation.faqEnabled?ensureMinimumFaq(initialPresentation.faq):initialPresentation.faq);
  const customVenue=venueName==="Другой зал";
  const cityOptions=useMemo(()=>Array.from(new Set([event.city,...israelCities,...venueCatalog.map(v=>v.city).filter(Boolean)])).filter(Boolean).sort((a,b)=>a.localeCompare(b,locale==="he"?"he":"ru")),[event.city,locale]);
  const venues=useMemo(()=>venueCatalog.filter(v=>(!city||v.city===city||v.name==="Другой зал")&&(!venueLetter||v.nameHe.startsWith(venueLetter))).sort((a,b)=>a.nameHe.localeCompare(b.nameHe,"he")),[city,venueLetter]);
  function chooseVenue(name:string){ setVenueName(name); const venue=findVenue(name); if(venue&&venue.name!=="Другой зал"){setCity(venue.city);setAddress(venue.address);} }
  function chooseCity(next:string){setCity(next); const current=findVenue(venueName); if(current&&current.city!==next){setVenueName("");setAddress("");}}

  async function submit(form:HTMLFormElement){
    const fd=new FormData(form); const links=String(fd.get("linkUrls")||"").split(/\r?\n/).map(u=>u.trim()).filter(Boolean).map(url=>({type:"LINK" as const,url})); const normalizedVideoUrl=videoUrl.trim(); const media:MediaItem[]=[...(videoEnabled&&normalizedVideoUrl?[{type:"VIDEO" as const,url:normalizedVideoUrl}]:[]),...links];
    const baseDescription=String(fd.get("description")||"").replace(PRESENTATION_MARKER,"").trim(); const marker=encodePresentation({shortDescription,ageRestriction,doorsOpenTime,galleryEnabled,galleryUrls,faqEnabled,faq}); const description=marker?`${baseDescription}\n${marker}`:baseDescription; const chosenDate=String(fd.get("startsAtDate")||event.startsAt.slice(0,10));
    setMessage(""); try { const response=await fetch(`/api/admin/events/${event.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update",title,description,posterUrl:fd.get("posterUrl"),startsAt:new Date(`${chosenDate}T${startTime}`).toISOString(),venueName,city,address,media})}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(typeof data.error==="string"?data.error:text.error); setMessage(text.saved); router.refresh(); } catch(error){setMessage(error instanceof Error?error.message:text.error);}
  }

  return <form className="panel form" style={{order:-1}} data-unified-save="about" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}}>
    <span className="eyebrow">О мероприятии</span><h2>Основная информация</h2>
    <div className="field"><label>{text.title}</label><input className="input" maxLength={TITLE_LIMIT} value={title} onChange={e=>setTitle(e.target.value)} required/><div className="row between"><small className="muted">{text.titleHelp}</small><small className="muted">{title.length}/{TITLE_LIMIT} {text.chars}</small></div></div>
    <div className="field"><label>{text.shortDescription}</label><textarea rows={3} maxLength={SHORT_DESCRIPTION_LIMIT} value={shortDescription} onChange={e=>setShortDescription(e.target.value)} placeholder={text.shortHelp}/></div>

    <section className={styles.infoPanelSection}>
      <header className={styles.infoPanelHeader}><h3>{text.publicPanel}</h3><p>{text.publicPanelHelp}</p></header>
      <div className={styles.infoControlStrip}>
        <label className={`${styles.infoControl} ${styles.dateControl}`}><CalendarDays/><span>{text.date}</span><input name="startsAtDate" type="date" defaultValue={event.startsAt.slice(0,10)} required/></label>
        <label className={`${styles.infoControl} ${styles.cityControl}`}><MapPin/><span>{text.city}</span><select value={city} onChange={e=>chooseCity(e.target.value)} required><option value="">-</option>{cityOptions.map(c=><option key={c}>{c}</option>)}</select></label>
        <label className={`${styles.infoControl} ${styles.venueControl}`}><Theater/><span>{text.venue}</span><select value={venueName} onChange={e=>chooseVenue(e.target.value)} required><option value="">-</option>{venues.map(v=><option key={v.name} value={v.name}>{locale==="he"?v.nameHe:v.name}</option>)}</select></label>
        <label className={`${styles.infoControl} ${styles.ageControl}`}><ShieldCheck/><span>{text.age}</span><select value={ageRestriction} onChange={e=>setAgeRestriction(e.target.value)}>{ageRestrictionOptions.map(r=><option key={r}>{r}</option>)}</select></label>
      </div>
      <div className={styles.venueAlphabet} aria-label="Hebrew venue alphabet"><button type="button" className={!venueLetter?styles.activeLetter:""} onClick={()=>setVenueLetter("")}>{text.allLetters}</button>{hebrewLetters.map(letter=><button type="button" key={letter} className={venueLetter===letter?styles.activeLetter:""} onClick={()=>setVenueLetter(letter)}>{letter}</button>)}</div>
      <div className={styles.infoDetailsGrid}>
        <label className={styles.detailField}><span><Clock3 size={17}/>{text.start}</span><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} required/></label>
        <label className={styles.detailField}><span><Clock3 size={17}/>{text.doors}</span><input type="time" value={doorsOpenTime} onChange={e=>setDoorsOpenTime(e.target.value)}/></label>
        <label className={`${styles.detailField} ${styles.addressField}`}><span><MapPin size={17}/>{text.address}</span><input value={address} onChange={e=>setAddress(e.target.value)} readOnly={!customVenue&&Boolean(findVenue(venueName))} required/></label>
      </div>
      {customVenue&&<small className={styles.panelHint}>{text.customVenue}</small>}
      <div className={styles.agePreview}><ShieldCheck size={18}/><div><strong>{text.ageInfo}</strong><p>{getAgeRestrictionDescription(ageRestriction,locale)}</p></div></div>
    </section>

    <div className="field"><label>{text.media}</label><div className={styles.mediaGrid}>
      <section className={styles.mediaCard}><header className={styles.cardHeader}><h3 className={styles.cardTitle}>{text.posterTitle}</h3><p className={styles.cardHelp}>{text.posterHelp}</p></header><PosterUploader initialUrl={event.posterUrl}/></section>
      <section className={styles.mediaCard}><header className={styles.cardHeader}><h3 className={styles.cardTitle}>{text.galleryTitle}</h3><label className={styles.toggleRow}><input type="checkbox" checked={galleryEnabled} onChange={e=>setGalleryEnabled(e.target.checked)}/><span>{text.galleryToggle}</span></label><p className={styles.cardHelp}>{text.galleryHelp}</p></header>{galleryEnabled?<EventGalleryUploader urls={galleryUrls} onChange={setGalleryUrls}/>:<div className={styles.disabledBody}>{text.galleryDisabled}</div>}</section>
      <section className={styles.mediaCard}><header className={styles.cardHeader}><h3 className={styles.cardTitle}>{text.videoTitle}</h3><label className={styles.toggleRow}><input type="checkbox" checked={videoEnabled} onChange={e=>setVideoEnabled(e.target.checked)}/><span>{text.videoToggle}</span></label><p className={styles.cardHelp}>{text.videoHelp}</p></header>{videoEnabled?<><EventVideoUploader url={videoUrl} onChange={setVideoUrl}/><div className={styles.urlField}><label>{text.videoLink}</label><input className="input" type="url" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)}/></div></>:<div className={styles.disabledBody}>{text.videoDisabled}</div>}</section>
    </div></div>
    <div className="field"><label>{text.description}</label><textarea name="description" rows={7} defaultValue={cleanDescription} required/></div>
    <div className="field"><label>{text.links}</label><textarea name="linkUrls" rows={3} defaultValue={event.media.filter(i=>i.type==="LINK").map(i=>i.url).join("\n")}/></div>
    <section className={styles.mediaCard}><header className={styles.cardHeader}><label className={styles.toggleRow}><input type="checkbox" checked={faqEnabled} onChange={e=>{setFaqEnabled(e.target.checked);if(e.target.checked)setFaq(current=>ensureMinimumFaq(current));}}/><span>{text.faqToggle}</span></label></header><EventFaqEditor items={faq} onChange={setFaq} disabled={!faqEnabled} questionLabel={text.faqQuestion} answerLabel={text.faqAnswer} help={text.faqHelp} duplicateLabel={text.faqDuplicate} insertLabel={text.faqInsert} deleteLabel={text.faqDelete} dragLabel={text.faqDrag} appendLabel={text.faqAppend} limitLabel={text.faqLimit}/></section>
    <button className="btn" data-workspace-local-save="true">{text.save}</button>{message&&<div className="toast" role="status">{message}</div>}
  </form>;
}
