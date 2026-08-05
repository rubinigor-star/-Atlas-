"use client";

import { useRef, useState } from "react";
import { Film, Plus, Trash2 } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { useLocale } from "@/components/locale-provider";
import styles from "@/components/event-media-manager.module.css";

const MAX_VIDEO_BYTES = 50_000_000;

type Props = {
  url: string;
  onChange: (url: string) => void;
};

const copy = {
  ru: {
    empty: "Видеофайл не загружен",
    linked: "Добавлена внешняя ссылка на видео",
    upload: "Загрузить видео",
    replace: "Заменить видео",
    remove: "Удалить видео",
    progress: "Загрузка видео",
    done: "Видео загружено. Сохраните основные данные.",
    typeError: "Выберите видео в формате MP4 или WebM",
    sizeError: "Размер видео не должен превышать 50 МБ",
    uploadError: "Не удалось загрузить видео",
  },
  he: {
    empty: "קובץ הווידאו עדיין לא הועלה",
    linked: "נוסף קישור חיצוני לווידאו",
    upload: "העלאת וידאו",
    replace: "החלפת וידאו",
    remove: "מחיקת וידאו",
    progress: "מעלה וידאו",
    done: "הווידאו הועלה. שמרו את פרטי האירוע.",
    typeError: "יש לבחור קובץ MP4 או WebM",
    sizeError: "גודל הווידאו לא יכול לעלות על 50MB",
    uploadError: "לא ניתן להעלות את הווידאו",
  },
  en: {
    empty: "No video file uploaded",
    linked: "An external video link was added",
    upload: "Upload video",
    replace: "Replace video",
    remove: "Remove video",
    progress: "Uploading video",
    done: "Video uploaded. Save the event details.",
    typeError: "Choose an MP4 or WebM video",
    sizeError: "Video must be no larger than 50 MB",
    uploadError: "Could not upload video",
  },
} as const;

function safeFileName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-|-$/g, "") || `event-video-${Date.now()}.mp4`;
}

function isDirectVideo(url: string) {
  return /\.(?:mp4|webm)(?:$|[?#])/i.test(url) || /blob\.vercel-storage\.com/i.test(url);
}

export function EventVideoUploader({ url, onChange }: Props) {
  const { locale } = useLocale();
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  async function choose(file?: File) {
    if (!file || busy) return;
    if (!/^(video\/mp4|video\/webm)$/.test(file.type)) {
      setMessage(text.typeError);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setMessage(text.sizeError);
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage("");
    try {
      const blob = await upload(`events/videos/${Date.now()}-${safeFileName(file.name)}`, file, {
        access: "public",
        contentType: file.type,
        handleUploadUrl: "/api/uploads/video",
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      onChange(blob.url);
      setMessage(text.done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.uploadError);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const directVideo = Boolean(url && isDirectVideo(url));
  const addLabel = url ? text.replace : text.upload;

  return <div className={styles.uploaderBody}>
    <input
      ref={inputRef}
      type="file"
      accept="video/mp4,video/webm"
      hidden
      onChange={(event) => void choose(event.target.files?.[0])}
    />

    <div className={styles.videoFrame}>
      {directVideo
        ? <video src={url} controls preload="metadata"/>
        : <div className={styles.emptyFrame}><span><Film size={30}/><br/>{url ? text.linked : text.empty}</span></div>}
      <button
        type="button"
        className={styles.addButton}
        aria-label={addLabel}
        title={addLabel}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Plus size={24}/>
      </button>
      {url && <button
        type="button"
        className={styles.removeButton}
        aria-label={text.remove}
        title={text.remove}
        disabled={busy}
        onClick={() => { onChange(""); setMessage(""); }}
      >
        <Trash2 size={15}/>
      </button>}
    </div>

    {busy && <progress className={styles.progress} value={progress} max={100}/>} 
    {busy && <div className={styles.galleryMeta}><span>{text.progress}</span><strong>{progress}%</strong></div>}
    {message && <div className={styles.status} role="status">{message}</div>}
  </div>;
}
