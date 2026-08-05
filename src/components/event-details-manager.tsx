"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PosterUploader } from "@/components/poster-uploader";
import { EventGalleryUploader } from "@/components/event-gallery-uploader";
import { useLocale } from "@/components/locale-provider";

type MediaItem =
  | { type: "VIDEO" | "IMAGE" | "LINK"; url: string; title?: string }
  | { type: "SUMMARY"; text: string };
type EventDetails = { id:string;title:string;description:string;posterUrl:string;media:MediaItem[];startsAt:string;venueName:string;city:string;address:string };

const labels = {
  ru: {
    title:"Официальное название мероприятия", short:"Краткое описание", shortHelp:"Показывается под названием на первом экране. Максимум 250 символов.", description:"Полное описание мероприятия", video:"Главное видео", videoHelp:"Добавьте одну ссылку YouTube или Vimeo. Видео откроется только после нажатия на Play.", links:"Дополнительные ссылки", date:"Дата и время", venue:"Площадка", city:"Город", address:"Полный адрес", save:"Сохранить основные данные", saved:"Изменения сохранены", error:"Не удалось сохранить изменения",
  },
  he: {
    title:"שם האירוע הרשמי", short:"תיאור קצר", shortHelp:"מוצג מתחת לשם במסך הראשון. עד 250 תווים.", description:"תיאור מלא של האירוע", video:"וידאו ראשי", videoHelp:"הוסיפו קישור אחד ל-YouTube או Vimeo. הווידאו ייפתח רק לאחר לחיצה על Play.", links:"קישורים נוספים", date:"תאריך ושעה", venue:"מקום האירוע", city:"עיר", address:"כתובת מלאה", save:"שמירת פרטי האירוע", saved:"השינויים נשמרו", error:"לא ניתן לשמור את השינויים",
  },
  en: {
    title:"Official event name", short:"Short description", shortHelp:"Shown below the title in the opening section. Maximum 250 characters.", description:"Full event description", video:"Main video", videoHelp:"Add one YouTube or Vimeo URL. The video opens only after the visitor presses Play.", links:"Additional links", date:"Date and time", venue:"Venue", city:"City", address:"Full address", save:"Save event details", saved:"Changes saved", error:"Could not save changes",
  },
} as const;

export function EventDetailsManager({ event }: { event: EventDetails }) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = labels[locale];
  const initialSummary = event.media.find((item) => item.type === "SUMMARY")?.text ?? "";
  const initialGallery = event.media.filter((item): item is Extract<MediaItem, { type: "IMAGE" }> => item.type === "IMAGE").map((item) => item.url);
  const initialVideo = event.media.find((item): item is Extract<MediaItem, { type: "VIDEO" }> => item.type === "VIDEO")?.url ?? "";
  const [shortDescription, setShortDescription] = useState(initialSummary);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const videoUrl = String(f.get("videoUrl") || "").trim();
    const linkMedia = String(f.get("linkUrls") || "").split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ type: "LINK" as const, url }));
    let galleryUrls: string[] = [];
    try {
      galleryUrls = JSON.parse(String(f.get("galleryUrlsJson") || "[]"));
      if (!Array.isArray(galleryUrls)) galleryUrls = [];
    } catch {
      galleryUrls = [];
    }
    const galleryEnabled = String(f.get("galleryEnabled")) === "true";

    setMessage("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: f.get("title"),
          description: f.get("description"),
          posterUrl: f.get("posterUrl"),
          startsAt: new Date(String(f.get("startsAt"))).toISOString(),
          venueName: f.get("venueName"),
          city: f.get("city"),
          address: f.get("address"),
          media: [...(videoUrl ? [{ type: "VIDEO" as const, url: videoUrl }] : []), ...linkMedia],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || text.error);

      const presentationResponse = await fetch(`/api/admin/events/${event.id}/presentation`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shortDescription, galleryEnabled, galleryUrls }),
      });
      const presentationData = await presentationResponse.json().catch(() => ({}));
      if (!presentationResponse.ok) throw new Error(presentationData.error || text.error);

      setMessage(text.saved);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
    } finally {
      setSaving(false);
    }
  }

  return <form className="panel form" style={{ order: -1 }} onSubmit={(submitEvent) => { submitEvent.preventDefault(); void submit(submitEvent.currentTarget); }}>
    <span className="eyebrow">О мероприятии</span>
    <h2>Основная информация и медиа</h2>

    <div className="field">
      <label>{text.title}</label>
      <input className="input" name="title" defaultValue={event.title} required/>
    </div>

    <div className="field">
      <label>{text.short}</label>
      <textarea name="shortDescription" rows={3} maxLength={250} value={shortDescription} onChange={(changeEvent) => setShortDescription(changeEvent.target.value)}/>
      <small className="muted">{text.shortHelp} {shortDescription.length}/250</small>
    </div>

    <PosterUploader initialUrl={event.posterUrl}/>

    <div className="field">
      <label>{text.description}</label>
      <textarea name="description" rows={7} defaultValue={event.description} required/>
    </div>

    <div className="field">
      <label>{text.video}</label>
      <input className="input" name="videoUrl" type="url" defaultValue={initialVideo} placeholder="https://youtube.com/watch?v=…"/>
      <small className="muted">{text.videoHelp}</small>
    </div>

    <EventGalleryUploader initialUrls={initialGallery}/>

    <div className="field">
      <label>{text.links}</label>
      <textarea name="linkUrls" rows={3} defaultValue={event.media.filter((item): item is Extract<MediaItem, { type: "LINK" }> => item.type === "LINK").map((item) => item.url).join("\n")}/>
    </div>

    <div className="form-grid two">
      <div className="field"><label>{text.date}</label><input className="input" name="startsAt" type="datetime-local" defaultValue={event.startsAt.slice(0, 16)} required/></div>
      <div className="field"><label>{text.venue}</label><input className="input" name="venueName" defaultValue={event.venueName} required/></div>
    </div>
    <div className="form-grid two">
      <div className="field"><label>{text.city}</label><input className="input" name="city" defaultValue={event.city} required/></div>
      <div className="field"><label>{text.address}</label><input className="input" name="address" defaultValue={event.address} required/></div>
    </div>

    <button className="btn" disabled={saving}>{saving ? "…" : text.save}</button>
    {message && <div className="toast" role="status">{message}</div>}
  </form>;
}