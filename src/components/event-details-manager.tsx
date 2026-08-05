"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PosterUploader } from "@/components/poster-uploader";
import { EventGalleryUploader } from "@/components/event-gallery-uploader";
import { EventVideoUploader } from "@/components/event-video-uploader";
import { EventFaqEditor } from "@/components/event-faq-editor";
import { useLocale } from "@/components/locale-provider";
import type { EventFaqItem } from "@/lib/event-presentation";
import styles from "@/components/event-media-manager.module.css";

type MediaItem = { type: "VIDEO" | "LINK"; url: string; title?: string };
type Presentation = {
  shortDescription: string;
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

const SHORT_DESCRIPTION_LIMIT = 150;
const PRESENTATION_MARKER = /<!--ATLAS_EVENT_PRESENTATION:([A-Za-z0-9+/=]+)-->/;

const labels = {
  ru: {
    title: "Официальное название мероприятия",
    shortDescription: "Краткое описание",
    shortHelp: "Показывается под названием мероприятия. Максимум 150 символов.",
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
    faqTitle: "FAQ мероприятия",
    faqToggle: "Добавить FAQ на страницу мероприятия",
    faqHelp: "До 7 пар вопрос-ответ. Пустые строки не публикуются.",
    faqDisabled: "Поставьте галочку, чтобы открыть компактную таблицу FAQ.",
    faqQuestion: "Вопрос",
    faqAnswer: "Ответ",
    date: "Дата и время",
    venue: "Площадка",
    city: "Город",
    address: "Полный адрес",
    save: "Сохранить все изменения",
    saved: "Изменения сохранены",
    error: "Не удалось сохранить изменения",
    chars: "символов",
  },
  he: {
    title: "השם הרשמי של האירוע",
    shortDescription: "תיאור קצר",
    shortHelp: "מופיע מתחת לשם האירוע. עד 150 תווים.",
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
    faqTitle: "שאלות נפוצות לאירוע",
    faqToggle: "הוספת FAQ לעמוד האירוע",
    faqHelp: "עד 7 זוגות של שאלה ותשובה. שורות ריקות לא יפורסמו.",
    faqDisabled: "סמנו את התיבה כדי לפתוח טבלת FAQ קומפקטית.",
    faqQuestion: "שאלה",
    faqAnswer: "תשובה",
    date: "תאריך ושעה",
    venue: "מקום האירוע",
    city: "עיר",
    address: "כתובת מלאה",
    save: "שמירת כל השינויים",
    saved: "השינויים נשמרו",
    error: "לא ניתן לשמור את השינויים",
    chars: "תווים",
  },
  en: {
    title: "Official event name",
    shortDescription: "Short description",
    shortHelp: "Shown below the event name. Maximum 150 characters.",
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
    faqTitle: "Event FAQ",
    faqToggle: "Add FAQ to the event page",
    faqHelp: "Up to 7 question-and-answer pairs. Empty rows are not published.",
    faqDisabled: "Select the checkbox to open the compact FAQ table.",
    faqQuestion: "Question",
    faqAnswer: "Answer",
    date: "Date and time",
    venue: "Venue",
    city: "City",
    address: "Full address",
    save: "Save all changes",
    saved: "Changes saved",
    error: "Could not save changes",
    chars: "characters",
  },
} as const;

function normalizeFaq(value: unknown): EventFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 7).map((item) => ({
    question: typeof item?.question === "string" ? item.question.slice(0, 180) : "",
    answer: typeof item?.answer === "string" ? item.answer.slice(0, 1200) : "",
  }));
}

function emptyPresentation(): Presentation {
  return { shortDescription: "", galleryEnabled: false, galleryUrls: [], faqEnabled: false, faq: [] };
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
  })).filter((item) => item.question || item.answer).slice(0, 7);
  const normalized = {
    shortDescription: value.shortDescription.trim().slice(0, SHORT_DESCRIPTION_LIMIT),
    galleryEnabled: value.galleryEnabled && value.galleryUrls.length > 0,
    galleryUrls: value.galleryUrls.slice(0, 6),
    faqEnabled: value.faqEnabled && faq.some((item) => item.question && item.answer),
    faq,
  };
  if (!normalized.shortDescription && !normalized.galleryUrls.length && !normalized.faq.length) return "";
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

  const [message, setMessage] = useState("");
  const [shortDescription, setShortDescription] = useState((event.shortDescription || initialPresentation.shortDescription).slice(0, SHORT_DESCRIPTION_LIMIT));
  const [videoEnabled, setVideoEnabled] = useState(Boolean(initialVideoUrl));
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [galleryEnabled, setGalleryEnabled] = useState(initialPresentation.galleryEnabled);
  const [galleryUrls, setGalleryUrls] = useState(initialPresentation.galleryUrls);
  const [faqEnabled, setFaqEnabled] = useState(initialPresentation.faqEnabled);
  const [faq, setFaq] = useState<EventFaqItem[]>(initialPresentation.faq);

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
    const marker = encodePresentation({ shortDescription, galleryEnabled, galleryUrls, faqEnabled, faq });
    const description = marker ? `${baseDescription}\n${marker}` : baseDescription;

    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: formData.get("title"),
          description,
          posterUrl: formData.get("posterUrl"),
          startsAt: new Date(String(formData.get("startsAt"))).toISOString(),
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
      <input className="input" name="title" defaultValue={event.title} required/>
    </div>

    <div className="field">
      <label>{text.shortDescription}</label>
      <textarea rows={3} maxLength={SHORT_DESCRIPTION_LIMIT} value={shortDescription} onChange={(changeEvent) => setShortDescription(changeEvent.target.value)} placeholder={text.shortHelp}/>
      <div className="row between" style={{ gap: 12 }}>
        <small className="muted">{text.shortHelp}</small>
        <small className="muted" style={{ whiteSpace: "nowrap" }}>{shortDescription.length}/{SHORT_DESCRIPTION_LIMIT} {text.chars}</small>
      </div>
    </div>

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

    <div className="field">
      <div className={styles.cardTitleRow}>
        <label>{text.faqTitle}</label>
        <label className={styles.toggleRow}>
          <input type="checkbox" checked={faqEnabled} onChange={(changeEvent) => setFaqEnabled(changeEvent.target.checked)}/>
          <span>{text.faqToggle}</span>
        </label>
      </div>
      {faqEnabled
        ? <EventFaqEditor items={faq} onChange={setFaq} questionLabel={text.faqQuestion} answerLabel={text.faqAnswer} help={text.faqHelp}/>
        : <div className={styles.disabledBody}>{text.faqDisabled}</div>}
    </div>

    <div className="form-grid two">
      <div className="field"><label>{text.date}</label><input className="input" name="startsAt" type="datetime-local" defaultValue={event.startsAt.slice(0, 16)} required/></div>
      <div className="field"><label>{text.venue}</label><input className="input" name="venueName" defaultValue={event.venueName} required/></div>
    </div>
    <div className="form-grid two">
      <div className="field"><label>{text.city}</label><input className="input" name="city" defaultValue={event.city} required/></div>
      <div className="field"><label>{text.address}</label><input className="input" name="address" defaultValue={event.address} required/></div>
    </div>

    <button className="btn" data-workspace-local-save="true">{text.save}</button>
    {message && <div className="toast" role="status">{message}</div>}
  </form>;
}
