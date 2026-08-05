"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { useLocale } from "@/components/locale-provider";

const MAX_VIDEO_BYTES = 300_000_000;

type Props = {
  url: string;
  onChange: (url: string) => void;
};

const copy = {
  ru: {
    upload: "Загрузить видеофайл",
    replace: "Заменить видеофайл",
    remove: "Удалить видео",
    help: "MP4 или WebM до 300 МБ. Файл загружается напрямую в видеохранилище.",
    progress: "Загрузка видео",
    done: "Видео загружено. Нажмите «Сохранить основные данные».",
    typeError: "Выберите видео в формате MP4 или WebM",
    sizeError: "Размер видео не должен превышать 300 МБ",
    uploadError: "Не удалось загрузить видео",
  },
  he: {
    upload: "העלאת קובץ וידאו",
    replace: "החלפת קובץ הווידאו",
    remove: "מחיקת וידאו",
    help: "MP4 או WebM עד 300MB. הקובץ מועלה ישירות לאחסון הווידאו.",
    progress: "מעלה וידאו",
    done: "הווידאו הועלה. לחצו על שמירת פרטי האירוע.",
    typeError: "יש לבחור קובץ MP4 או WebM",
    sizeError: "גודל הווידאו לא יכול לעלות על 300MB",
    uploadError: "לא ניתן להעלות את הווידאו",
  },
  en: {
    upload: "Upload video file",
    replace: "Replace video file",
    remove: "Remove video",
    help: "MP4 or WebM up to 300 MB. The file uploads directly to video storage.",
    progress: "Uploading video",
    done: "Video uploaded. Save the event details to apply it.",
    typeError: "Choose an MP4 or WebM video",
    sizeError: "Video must be no larger than 300 MB",
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

  return <div className="field">
    <input
      ref={inputRef}
      type="file"
      accept="video/mp4,video/webm"
      hidden
      onChange={(event) => void choose(event.target.files?.[0])}
    />

    <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <button type="button" className="btn secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={17}/>{busy ? `${text.progress} ${progress}%` : url && isDirectVideo(url) ? text.replace : text.upload}
      </button>
      {url && <button type="button" className="btn secondary danger" disabled={busy} onClick={() => { onChange(""); setMessage(""); }}>
        <Trash2 size={17}/>{text.remove}
      </button>}
    </div>

    {busy && <progress value={progress} max={100} style={{ width: "100%", height: 10 }}/>} 
    <small className="muted">{text.help}</small>
    {url && isDirectVideo(url) && <video src={url} controls preload="metadata" style={{ width: "min(560px,100%)", aspectRatio: "16 / 9", objectFit: "contain", borderRadius: 16, background: "#090b12", marginTop: 10 }}/>} 
    {message && <div className="toast" style={{ marginTop: 10 }}>{message}</div>}
  </div>;
}
