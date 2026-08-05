"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PosterUploader } from "@/components/poster-uploader";
import { EventGalleryUploader } from "@/components/event-gallery-uploader";
import { useLocale } from "@/components/locale-provider";

type MediaItem = { type: "VIDEO" | "LINK"; url: string; title?: string };
type Presentation = { shortDescription: string; galleryEnabled: boolean; galleryUrls: string[] };
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

const PRESENTATION_MARKER = /<!--ATLAS_EVENT_PRESENTATION:([A-Za-z0-9+/=]+)-->/;

const labels = {
  ru: {
    title: "Официальное название мероприятия",
    shortDescription: "Краткое описание",
    shortHelp: "Показывается под названием мероприятия. Максимум 250 символов.",
    description: "Полное описание",
    videoCheck: "Добавить видео",
    video: "Главное видео мероприятия",
    videoHelp: "Ссылка YouTube или Vimeo. Видео откроется только после нажатия Play.",
    galleryCheck: "Добавить изображения в галерею",
    galleryHelp: "До 6 квадратных изображений. Рекомендуемый размер: 750 × 750 px.",
    links: "Дополнительные ссылки",
    date: "Дата и время",
    venue: "Площадка",
    city: "Город",
    address: "Полный адрес",
    save: "Сохранить основные данные",
    saved: "Изменения сохранены",
    error: "Не удалось сохранить изменения",
    chars: "символов",
  },
  he: {
    title: "השם הרשמי של האירוע",
    shortDescription: "תיאור קצר",
    shortHelp: "מופיע מתחת לשם האירוע. עד 250 תווים.",
    description: "תיאור מלא",
    videoCheck: "הוספת וידאו",
    video: "הווידאו הראשי של האירוע",
    videoHelp: "קישור YouTube או Vimeo. הווידאו ייפתח רק לאחר לחיצה על Play.",
    galleryCheck: "הוספת תמונות לגלריה",
    galleryHelp: "עד 6 תמונות מרובעות. גודל מומלץ: 750 × 750 פיקסלים.",
    links: "קישורים נוספים",
    date: "תאריך ושעה",
    venue: "מקום האירוע",
    city: "עיר",
    address: "כתובת מלאה",
    save: "שמירת פרטי האירוע",
    saved: "השינויים נשמרו",
    error: "לא ניתן לשמור את השינויים",
    chars: "תווים",
  },
  en: {
    title: "Official event name",
    shortDescription: "Short description",
    shortHelp: "Shown below the event name. Maximum 250 characters.",
    description: "Full description",
    videoCheck: "Add video",
    video: "Main event video",
    videoHelp: "YouTube or Vimeo URL. The video opens only after the visitor presses Play.",
    galleryCheck: "Add images to the gallery",
    galleryHelp: "Up to 6 square images. Recommended size: 750 × 750 px.",
    links: "Additional links",
    date: "Date and time",
    venue: "Venue",
    city: "City",
    address: "Full address",
    save: "Save event details",
    saved: "Changes saved",
    error: "Could not save changes",
    chars: "characters",
  },
} as const;

function decodePresentation(description: string): Presentation {
  const encoded = description.match(PRESENTATION_MARKER)?.[1];
  if (!encoded || typeof window === "undefined") return { shortDescription: "", galleryEnabled: false, galleryUrls: [] };
  try {
    const binary = window.atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const galleryUrls = Array.isArray(parsed?.galleryUrls)
      ? parsed.galleryUrls.filter((url: unknown): url is string => typeof url === "string" && /^https?:\/\//i.test(url)).slice(0, 6)
      : [];
    return {
      shortDescription: typeof parsed?.shortDescription === "string" ? parsed.shortDescription.slice(0, 250) : "",
      galleryEnabled: parsed?.galleryEnabled === true && galleryUrls.length > 0,
      galleryUrls,
    };
  } catch {
    return { shortDescription: "", galleryEnabled: false, galleryUrls: [] };
  }
}

function encodePresentation(value: Presentation) {
  const normalized = {
    shortDescription: value.shortDescription.trim().slice(0, 250),
    galleryEnabled: value.galleryEnabled && value.galleryUrls.length > 0,
    galleryUrls: value.galleryUrls.slice(0, 6),
  };
  if (!normalized.shortDescription && !normalized.galleryUrls.length) return "";
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
  const [shortDescription, setShortDescription] = useState(event.shortDescription || initialPresentation.shortDescription);
  const [videoEnabled, setVideoEnabled] = useState(Boolean(initialVideoUrl));
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [galleryEnabled, setGalleryEnabled] = useState(initialPresentation.galleryEnabled);
  const [galleryUrls, setGalleryUrls] = useState(initialPresentation.galleryUrls);

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
    const marker = encodePresentation({
      shortDescription,
      galleryEnabled,
      galleryUrls,
    });
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

  return <form className="panel form" style={{ order: -1 }} onSubmit={(submitEvent) => {
    submitEvent.preventDefault();
    void submit(submitEvent.currentTarget);
  }}>
    <span className="eyebrow">О мероприятии</span>
    <h2>Основная информация</h2>

    <div className="field">
      <label>{text.title}</label>
      <input className="input" name="title" defaultValue={event.title} required/>
    </div>

    <div className="field">
      <label>{text.shortDescription}</label>
      <textarea rows={3} maxLength={250} value={shortDescription} onChange={(changeEvent) => setShortDescription(changeEvent.target.value)} placeholder={text.shortHelp}/>
      <div className="row between" style={{ gap: 12 }}>
        <small className="muted">{text.shortHelp}</small>
        <small className="muted" style={{ whiteSpace: "nowrap" }}>{shortDescription.length}/250 {text.chars}</small>
      </div>
    </div>

    <PosterUploader initialUrl={event.posterUrl}/>

    <label className="check-row">
      <input type="checkbox" checked={videoEnabled} onChange={(changeEvent) => setVideoEnabled(changeEvent.target.checked)}/>
      <span><strong>{text.videoCheck}</strong><small>{text.videoHelp}</small></span>
    </label>
    {videoEnabled && <div className="field">
      <label>{text.video}</label>
      <input className="input" type="url" value={videoUrl} onChange={(changeEvent) => setVideoUrl(changeEvent.target.value)} placeholder="https://youtube.com/watch?v=..."/>
    </div>}

    <label className="check-row">
      <input type="checkbox" checked={galleryEnabled} onChange={(changeEvent) => setGalleryEnabled(changeEvent.target.checked)}/>
      <span><strong>{text.galleryCheck}</strong><small>{text.galleryHelp}</small></span>
    </label>
    {galleryEnabled && <EventGalleryUploader urls={galleryUrls} onChange={setGalleryUrls}/>} 

    <div className="field">
      <label>{text.description}</label>
      <textarea name="description" rows={7} defaultValue={cleanDescription} required/>
    </div>

    <div className="field">
      <label>{text.links}</label>
      <textarea name="linkUrls" rows={3} defaultValue={event.media.filter((item) => item.type === "LINK").map((item) => item.url).join("\n")}/>
    </div>

    <div className="form-grid two">
      <div className="field"><label>{text.date}</label><input className="input" name="startsAt" type="datetime-local" defaultValue={event.startsAt.slice(0, 16)} required/></div>
      <div className="field"><label>{text.venue}</label><input className="input" name="venueName" defaultValue={event.venueName} required/></div>
    </div>
    <div className="form-grid two">
      <div className="field"><label>{text.city}</label><input className="input" name="city" defaultValue={event.city} required/></div>
      <div className="field"><label>{text.address}</label><input className="input" name="address" defaultValue={event.address} required/></div>
    </div>

    <button className="btn">{text.save}</button>
    {message && <div className="toast" role="status">{message}</div>}
  </form>;
}
