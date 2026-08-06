"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, ShieldCheck, Theater } from "lucide-react";
import { PosterUploader } from "@/components/poster-uploader";
import { EventGalleryUploader } from "@/components/event-gallery-uploader";
import { EventVideoUploader } from "@/components/event-video-uploader";
import { EventFaqEditor } from "@/components/event-faq-editor";
import { useLocale } from "@/components/locale-provider";
import type { EventFaqItem } from "@/lib/event-presentation";
import { israelCities } from "@/lib/israel-cities";
import styles from "@/components/event-media-manager.module.css";

type MediaItem = { type: "VIDEO" | "LINK"; url: string; title?: string };
type Presentation = {
  shortDescription: string;
  ageRestriction: string;
  galleryEnabled: boolean;
  galleryUrls: string[];
  faqEnabled: boolean;
  faq: EventFaqItem[];
};
type EventDetails = {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  posterUrl: string;
  media: MediaItem[];
  startsAt: string;
  venueName: string;
  city: string;
  address: string;
};

const TITLE_LIMIT = 50;
const SHORT_DESCRIPTION_LIMIT = 100;
const MAX_FAQ_ITEMS = 15;
const MIN_FAQ_ITEMS = 3;
const EMPTY_FAQ_ITEM: EventFaqItem = { question: "", answer: "" };
const PRESENTATION_MARKER = /<!--ATLAS_EVENT_PRESENTATION:([A-Za-z0-9+/=]+)-->/;
const AGE_RESTRICTIONS = ["Детское", "3+", "6+", "12+", "16+", "18+", "Без ограничений"];
const ISRAEL_VENUES = [
  "Reading 3", "Hangar 11", "Expo Tel Aviv", "Menora Mivtachim Arena", "Heichal HaTarbut Tel Aviv",
  "Barby Tel Aviv", "Zappa Tel Aviv", "Zappa Herzliya", "Zappa Haifa", "Zappa Jerusalem",
  "Gray Tel Aviv", "Gray Yehud", "Gray Modi'in", "Gray Kfar Saba", "Amphi Shuni",
  "Caesarea Amphitheater", "Sultan's Pool", "Pais Arena Jerusalem", "International Convention Center Haifa",
  "Romema Arena", "Congress Center Haifa", "Auditorium Haifa", "Krieger Arts Center", "Beit Nagler",
  "MALINA Night Club", "Другой зал",
];

const labels = {
  ru: {
    title: "Официальное название мероприятия",
    titleHelp: "Максимум 50 символов.",
    shortDescription: "Краткое описание",
    shortHelp: "Показывается под названием мероприятия. Максимум 100 символов.",
    publicPanel: "Информационная панель страницы мероприятия",
    publicPanelHelp: "Эти четыре значения отображаются в верхней панели страницы мероприятия.",
    date: "Дата",
    city: "Город",
    venue: "Зал",
    age: "Возраст",
    media: "Медиафайлы мероприятия",
    posterTitle: "Главная афиша",
    posterHelp: "Обязательный квадрат 750 × 750 px. JPG, PNG или WebP. Исходный файл до 15 МБ. Афиша автоматически кадрируется по центру и оптимизируется.",
    galleryTitle: "Галерея",
    galleryToggle: "Добавить галерею",
    galleryHelp: "До 6 фотографий. Рекомендуемый формат: горизонтальный 4:3, 1600 × 1200 px. Обязательное ограничение только одно: не больше 1 МБ на фотографию.",
    galleryDisabled: "Поставьте галочку, чтобы открыть шесть ячеек для загрузки фотографий.",
    videoTitle: "Видео",
    videoToggle: "Добавить видео",
    videoHelp: "Рекомендуемый размер: 1920 × 1080 px, формат 16:9. MP4 или WebM, не больше 50 МБ. Также можно вставить ссылку YouTube или Vimeo.",
    videoDisabled: "Поставьте галочку, чтобы загрузить видеофайл или добавить ссылку.",
    videoLink: "Ссылка YouTube или Vimeo",
    description: "Полное описание",
    links: "Дополнительные ссылки",
    faqToggle: "Добавить FAQ на страницу мероприятия",
    faqHelp: "До 15 пар вопрос-ответ. Пустые строки не публикуются.",
    faqQuestion: "Вопрос",
    faqAnswer: "Ответ",
    faqDuplicate: "Дублировать вопрос и ответ",
    faqInsert: "Добавить вопрос ниже",
    faqDelete: "Удалить вопрос",
    faqDrag: "Перетащить для изменения порядка",
    faqAppend: "Добавить вопрос",
    faqLimit: "Достигнут максимум 15 вопросов",
    address: "Полный адрес",
    save: "Сохранить все изменения",
    saved: "Изменения сохранены",
    error: "Не удалось сохранить изменения",
    chars: "символов",
  },
  he: {
    title: "השם הרשמי של האירוע",
    titleHelp: "עד 50 תווים.",
    shortDescription: "תיאור קצר",
    shortHelp: "מופיע מתחת לשם האירוע. עד 100 תווים.",
    publicPanel: "סרגל המידע בעמוד האירוע",
    publicPanelHelp: "ארבעת הערכים האלה מוצגים בסרגל העליון של עמוד האירוע.",
    date: "תאריך",
    city: "עיר",
    venue: "אולם",
    age: "הגבלת גיל",
    media: "מדיה לאירוע",
    posterTitle: "כרזה ראשית",
    posterHelp: "ריבוע חובה בגודל 750 × 750 פיקסלים. JPG, PNG או WebP. קובץ מקור עד 15MB. הכרזה נחתכת למרכז ומותאמת אוטומטית.",
    galleryTitle: "גלריה",
    galleryToggle: "הוספת גלריה",
    galleryHelp: "עד 6 תמונות. המלצה: פורמט אופקי 4:3 בגודל 1600 × 1200 פיקסלים. ההגבלה היחידה היא משקל של עד 1MB לכל תמונה.",
    galleryDisabled: "סמנו את התיבה כדי לפתוח שש משבצות להעלאת תמונות.",
    videoTitle: "וידאו",
    videoToggle: "הוספת וידאו",
    videoHelp: "גודל מומלץ: 1920 × 1080 פיקסלים, יחס 16:9. MP4 או WebM עד 50MB. אפשר גם להוסיף קישור YouTube או Vimeo.",
    videoDisabled: "סמנו את התיבה כדי להעלות קובץ וידאו או להוסיף קישור.",
    videoLink: "קישור YouTube או Vimeo",
    description: "תיאור מלא",
    links: "קישורים נוספים",
    faqToggle: "הוספת FAQ לעמוד האירוע",
    faqHelp: "עד 15 זוגות של שאלה ותשובה. שורות ריקות לא יפורסמו.",
    faqQuestion: "שאלה",
    faqAnswer: "תשובה",
    faqDuplicate: "שכפול השאלה והתשובה",
    faqInsert: "הוספת שאלה מתחת",
    faqDelete: "מחיקת השאלה",
    faqDrag: "גרירה לשינוי הסדר",
    faqAppend: "הוספת שאלה",
    faqLimit: "הגעתם למקסימום של 15 שאלות",
    address: "כתובת מלאה",
    save: "שמירת כל השינויים",
    saved: "השינויים נשמרו",
    error: "לא ניתן לשמור את השינויים",
    chars: "תווים",
  },
  en: {
    title: "Official event name",
    titleHelp: "Maximum 50 characters.",
    shortDescription: "Short description",
    shortHelp: "Shown below the event name. Maximum 100 characters.",
    publicPanel: "Event page information bar",
    publicPanelHelp: "These four values appear in the event page's upper information bar.",
    date: "Date",
    city: "City",
    venue: "Venue",
    age: "Age restriction",
    media: "Event media",
    posterTitle: "Main poster",
    posterHelp: "Required square format: 750 × 750 px. JPG, PNG or WebP. Source file up to 15 MB. The poster is centered, cropped and optimized automatically.",
    galleryTitle: "Gallery",
    galleryToggle: "Add gallery",
    galleryHelp: "Up to 6 photos. Recommended format: horizontal 4:3 at 1600 × 1200 px. The only required limit is 1 MB per photo.",
    galleryDisabled: "Select the checkbox to open six photo upload slots.",
    videoTitle: "Video",
    videoToggle: "Add video",
    videoHelp: "Recommended size: 1920 × 1080 px in 16:9. MP4 or WebM up to 50 MB. A YouTube or Vimeo link can also be used.",
    videoDisabled: "Select the checkbox to upload a video file or add a link.",
    videoLink: "YouTube or Vimeo link",
    description: "Full description",
    links: "Additional links",
    faqToggle: "Add FAQ to the event page",
    faqHelp: "Up to 15 question-and-answer pairs. Empty rows are not published.",
    faqQuestion: "Question",
    faqAnswer: "Answer",
    faqDuplicate: "Duplicate question and answer",
    faqInsert: "Add a question below",
    faqDelete: "Delete question",
    faqDrag: "Drag to change the order",
    faqAppend: "Add question",
    faqLimit: "Maximum of 15 questions reached",
    address: "Full address",
    save: "Save all changes",
    saved: "Changes saved",
    error: "Could not save changes",
    chars: "characters",
  },
} as const;

function normalizeFaq(value: unknown): EventFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_FAQ_ITEMS).map((item) => ({
    question: typeof item?.question === "string" ? item.question.slice(0, 180) : "",
    answer: typeof item?.answer === "string" ? item.answer.slice(0, 1200) : "",
  }));
}

function ensureMinimumFaq(items: EventFaqItem[]) {
  const next = items.slice(0, MAX_FAQ_ITEMS).map((item) => ({ ...item }));
  while (next.length < MIN_FAQ_ITEMS) next.push({ ...EMPTY_FAQ_ITEM });
  return next;
}

function emptyPresentation(): Presentation {
  return { shortDescription: "", ageRestriction: "Без ограничений", galleryEnabled: false, galleryUrls: [], faqEnabled: false, faq: [] };
}

function decodePresentation(description: string): Presentation {
  const encoded = description.match(PRESENTATION_MARKER)?.[1];
  if (!encoded || typeof window === "undefined") return emptyPresentation();
  try {
    const binary = window.atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const galleryUrls = Array.isArray(parsed?.galleryUrls)
      ? parsed.galleryUrls.filter((url: unknown): url is string => typeof url === "string" && /^(?:https?:\/\/|data:image\/)/i.test(url)).slice(0, 6)
      : [];
    const faq = normalizeFaq(parsed?.faq);
    return {
      shortDescription: typeof parsed?.shortDescription === "string" ? parsed.shortDescription.slice(0, SHORT_DESCRIPTION_LIMIT) : "",
      ageRestriction: typeof parsed?.ageRestriction === "string" && AGE_RESTRICTIONS.includes(parsed.ageRestriction) ? parsed.ageRestriction : "Без ограничений",
      galleryEnabled: parsed?.galleryEnabled === true && galleryUrls.length > 0,
      galleryUrls,
      faqEnabled: typeof parsed?.faqEnabled === "boolean" ? parsed.faqEnabled : faq.length > 0,
      faq,
    };
  } catch {
    return emptyPresentation();
  }
}

function encodePresentation(value: Presentation) {
  const faq = value.faq.map((item) => ({
    question: item.question.trim().slice(0, 180),
    answer: item.answer.trim().slice(0, 1200),
  })).filter((item) => item.question || item.answer).slice(0, MAX_FAQ_ITEMS);
  const normalized = {
    shortDescription: value.shortDescription.trim().slice(0, SHORT_DESCRIPTION_LIMIT),
    ageRestriction: AGE_RESTRICTIONS.includes(value.ageRestriction) ? value.ageRestriction : "Без ограничений",
    galleryEnabled: value.galleryEnabled && value.galleryUrls.length > 0,
    galleryUrls: value.galleryUrls.slice(0, 6),
    faqEnabled: value.faqEnabled && faq.some((item) => item.question && item.answer),
    faq,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(normalized));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `<!--ATLAS_EVENT_PRESENTATION:${window.btoa(binary)}-->`;
}

export function EventDetailsManager({ event }: { event: EventDetails }) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = labels[locale];
  const initialPresentation = useMemo(() => decodePresentation(event.description), [event.description]);
  const cleanDescription = useMemo(() => event.description.replace(PRESENTATION_MARKER, "").trim(), [event.description]);
  const initialVideoUrl = event.media.find((item) => item.type === "VIDEO")?.url || "";
  const cityOptions = useMemo(() => event.city && !israelCities.includes(event.city as (typeof israelCities)[number]) ? [event.city, ...israelCities] : [...israelCities], [event.city]);
  const venueOptions = useMemo(() => event.venueName && !ISRAEL_VENUES.includes(event.venueName) ? [event.venueName, ...ISRAEL_VENUES] : ISRAEL_VENUES, [event.venueName]);

  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(event.title.slice(0, TITLE_LIMIT));
  const [shortDescription, setShortDescription] = useState((event.shortDescription || initialPresentation.shortDescription).slice(0, SHORT_DESCRIPTION_LIMIT));
  const [ageRestriction, setAgeRestriction] = useState(initialPresentation.ageRestriction);
  const [videoEnabled, setVideoEnabled] = useState(Boolean(initialVideoUrl));
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [galleryEnabled, setGalleryEnabled] = useState(initialPresentation.galleryEnabled);
  const [galleryUrls, setGalleryUrls] = useState(initialPresentation.galleryUrls);
  const [faqEnabled, setFaqEnabled] = useState(initialPresentation.faqEnabled);
  const [faq, setFaq] = useState<EventFaqItem[]>(initialPresentation.faqEnabled ? ensureMinimumFaq(initialPresentation.faq) : initialPresentation.faq);

  async function submit(form: HTMLFormElement) {
    const formData = new FormData(form);
    const links = String(formData.get("linkUrls") || "")
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ type: "LINK" as const, url }));
    const normalizedVideoUrl = videoUrl.trim();
    const media: MediaItem[] = [
      ...(videoEnabled && normalizedVideoUrl ? [{ type: "VIDEO" as const, url: normalizedVideoUrl }] : []),
      ...links,
    ];
    const baseDescription = String(formData.get("description") || "").replace(PRESENTATION_MARKER, "").trim();
    const marker = encodePresentation({ shortDescription, ageRestriction, galleryEnabled, galleryUrls, faqEnabled, faq });
    const description = marker ? `${baseDescription}\n${marker}` : baseDescription;
    const chosenDate = String(formData.get("startsAtDate") || event.startsAt.slice(0, 10));
    const existingTime = event.startsAt.slice(11, 16) || "12:00";

    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title,
          description,
          posterUrl: formData.get("posterUrl"),
          startsAt: new Date(`${chosenDate}T${existingTime}`).toISOString(),
          venueName: formData.get("venueName"),
          city: formData.get("city"),
          address: formData.get("address"),
          media,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      setMessage(text.saved);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
    }
  }

  return <form
    className="panel form"
    style={{ order: -1 }}
    data-unified-save="about"
    onSubmit={(submitEvent) => {
      submitEvent.preventDefault();
      void submit(submitEvent.currentTarget);
    }}
  >
    <span className="eyebrow">О мероприятии</span>
    <h2>Основная информация</h2>

    <div className="field">
      <label>{text.title}</label>
      <input className="input" name="title" maxLength={TITLE_LIMIT} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} required/>
      <div className="row between" style={{ gap: 12 }}>
        <small className="muted">{text.titleHelp}</small>
        <small className="muted" style={{ whiteSpace: "nowrap" }}>{title.length}/{TITLE_LIMIT} {text.chars}</small>
      </div>
    </div>

    <div className="field">
      <label>{text.shortDescription}</label>
      <textarea rows={3} maxLength={SHORT_DESCRIPTION_LIMIT} value={shortDescription} onChange={(changeEvent) => setShortDescription(changeEvent.target.value)} placeholder={text.shortHelp}/>
      <div className="row between" style={{ gap: 12 }}>
        <small className="muted">{text.shortHelp}</small>
        <small className="muted" style={{ whiteSpace: "nowrap" }}>{shortDescription.length}/{SHORT_DESCRIPTION_LIMIT} {text.chars}</small>
      </div>
    </div>

    <section className={styles.infoPanelSection}>
      <header className={styles.infoPanelHeader}>
        <h3>{text.publicPanel}</h3>
        <p>{text.publicPanelHelp}</p>
      </header>
      <div className={styles.infoControlStrip}>
        <label className={styles.infoControl}>
          <CalendarDays size={20}/>
          <span>{text.date}</span>
          <input name="startsAtDate" type="date" defaultValue={event.startsAt.slice(0, 10)} required/>
        </label>
        <label className={styles.infoControl}>
          <MapPin size={20}/>
          <span>{text.city}</span>
          <select name="city" defaultValue={event.city} required>
            {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className={styles.infoControl}>
          <Theater size={20}/>
          <span>{text.venue}</span>
          <select name="venueName" defaultValue={event.venueName} required>
            {venueOptions.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
          </select>
        </label>
        <label className={styles.infoControl}>
          <ShieldCheck size={20}/>
          <span>{text.age}</span>
          <select value={ageRestriction} onChange={(changeEvent) => setAgeRestriction(changeEvent.target.value)} size={1}>
            {AGE_RESTRICTIONS.map((restriction) => <option key={restriction} value={restriction}>{restriction}</option>)}
          </select>
        </label>
      </div>
      <div className="field"><label>{text.address}</label><input className="input" name="address" defaultValue={event.address} required/></div>
    </section>

    <div className="field">
      <label>{text.media}</label>
      <div className={styles.mediaGrid}>
        <section className={styles.mediaCard}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleRow}><h3 className={styles.cardTitle}>{text.posterTitle}</h3></div>
            <p className={styles.cardHelp}>{text.posterHelp}</p>
          </header>
          <PosterUploader initialUrl={event.posterUrl}/>
        </section>

        <section className={styles.mediaCard}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleRow}><h3 className={styles.cardTitle}>{text.galleryTitle}</h3></div>
            <label className={styles.toggleRow}>
              <input type="checkbox" checked={galleryEnabled} onChange={(changeEvent) => setGalleryEnabled(changeEvent.target.checked)}/>
              <span>{text.galleryToggle}</span>
            </label>
            <p className={styles.cardHelp}>{text.galleryHelp}</p>
          </header>
          {galleryEnabled
            ? <EventGalleryUploader urls={galleryUrls} onChange={setGalleryUrls}/>
            : <div className={styles.disabledBody}>{text.galleryDisabled}</div>}
        </section>

        <section className={styles.mediaCard}>
          <header className={styles.cardHeader}>
            <div className={styles.cardTitleRow}><h3 className={styles.cardTitle}>{text.videoTitle}</h3></div>
            <label className={styles.toggleRow}>
              <input type="checkbox" checked={videoEnabled} onChange={(changeEvent) => setVideoEnabled(changeEvent.target.checked)}/>
              <span>{text.videoToggle}</span>
            </label>
            <p className={styles.cardHelp}>{text.videoHelp}</p>
          </header>
          {videoEnabled ? <>
            <EventVideoUploader url={videoUrl} onChange={setVideoUrl}/>
            <div className={styles.urlField}>
              <label>{text.videoLink}</label>
              <input className="input" type="url" value={videoUrl} onChange={(changeEvent) => setVideoUrl(changeEvent.target.value)} placeholder="https://youtube.com/watch?v=..."/>
            </div>
          </> : <div className={styles.disabledBody}>{text.videoDisabled}</div>}
        </section>
      </div>
    </div>

    <div className="field">
      <label>{text.description}</label>
      <textarea name="description" rows={7} defaultValue={cleanDescription} required/>
    </div>

    <div className="field">
      <label>{text.links}</label>
      <textarea name="linkUrls" rows={3} defaultValue={event.media.filter((item) => item.type === "LINK").map((item) => item.url).join("\n")}/>
    </div>

    <section className={styles.mediaCard}>
      <header className={styles.cardHeader}>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={faqEnabled}
            onChange={(changeEvent) => {
              const enabled = changeEvent.target.checked;
              setFaqEnabled(enabled);
              if (enabled) setFaq((current) => ensureMinimumFaq(current));
            }}
          />
          <span>{text.faqToggle}</span>
        </label>
      </header>
      <EventFaqEditor
        items={faq}
        onChange={setFaq}
        disabled={!faqEnabled}
        questionLabel={text.faqQuestion}
        answerLabel={text.faqAnswer}
        help={text.faqHelp}
        duplicateLabel={text.faqDuplicate}
        insertLabel={text.faqInsert}
        deleteLabel={text.faqDelete}
        dragLabel={text.faqDrag}
        appendLabel={text.faqAppend}
        limitLabel={text.faqLimit}
      />
    </section>

    <button className="btn" data-workspace-local-save="true">{text.save}</button>
    {message && <div className="toast" role="status">{message}</div>}
  </form>;
}
