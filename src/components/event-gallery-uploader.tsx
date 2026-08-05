"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 1200;
const TARGET_RATIO = OUTPUT_WIDTH / OUTPUT_HEIGHT;
const MAX_SOURCE_BYTES = 15_000_000;
const MAX_UPLOAD_BYTES = 850_000;
const MAX_IMAGES = 6;

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
};

const copy = {
  ru: {
    add: "Добавить изображения",
    busy: "Загрузка…",
    help: "До 6 фотографий. Горизонтальный формат 4:3. Идеальный размер: 1600 × 1200 px. Максимальный исходный файл: 15 МБ. Изображение автоматически обрезается по центру и оптимизируется.",
    remove: "Удалить изображение",
    optimize: "Оптимизируем изображения…",
    upload: "Загружаем изображения…",
    done: "Изображения добавлены. Нажмите «Сохранить основные данные».",
    error: "Не удалось загрузить изображение",
  },
  he: {
    add: "הוספת תמונות",
    busy: "מעלה…",
    help: "עד 6 תמונות. פורמט אופקי 4:3. גודל אידיאלי: 1600 × 1200 פיקסלים. קובץ מקור עד 15MB. התמונה נחתכת מהמרכז ועוברת אופטימיזציה אוטומטית.",
    remove: "מחיקת תמונה",
    optimize: "מבצע אופטימיזציה לתמונות…",
    upload: "מעלה תמונות…",
    done: "התמונות נוספו. לחצו על שמירת פרטי האירוע.",
    error: "לא ניתן להעלות את התמונה",
  },
  en: {
    add: "Add images",
    busy: "Uploading…",
    help: "Up to 6 photos. Horizontal 4:3 format. Ideal size: 1600 × 1200 px. Maximum source file: 15 MB. Images are center-cropped and optimized automatically.",
    remove: "Remove image",
    optimize: "Optimizing images…",
    upload: "Uploading images…",
    done: "Images added. Save the event details to apply them.",
    error: "Could not upload image",
  },
} as const;

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function optimizeImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("JPG, PNG or WebP only");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Image is larger than 15 MB");

  const image = await loadImage(file);
  const sourceRatio = image.width / image.height;
  let cropWidth = image.width;
  let cropHeight = image.height;

  if (sourceRatio > TARGET_RATIO) {
    cropWidth = Math.round(image.height * TARGET_RATIO);
  } else if (sourceRatio < TARGET_RATIO) {
    cropHeight = Math.round(image.width / TARGET_RATIO);
  }

  const sourceX = Math.max(0, Math.round((image.width - cropWidth) / 2));
  const sourceY = Math.max(0, Math.round((image.height - cropHeight) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  if ("close" in image && typeof image.close === "function") image.close();

  let quality = 0.88;
  let blob: Blob | null = null;
  while (quality >= 0.46) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.07;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("Could not compress image");
  return new File([blob], `event-gallery-${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export function EventGalleryUploader({ urls, onChange }: Props) {
  const { locale } = useLocale();
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function choose(files?: FileList | null) {
    if (!files?.length || busy) return;
    const available = Math.max(0, MAX_IMAGES - urls.length);
    const selected = Array.from(files).slice(0, available);
    if (!selected.length) return;

    setBusy(true);
    setMessage(text.optimize);
    try {
      const next = [...urls];
      for (const file of selected) {
        const optimized = await optimizeImage(file);
        const form = new FormData();
        form.append("image", optimized);
        setMessage(text.upload);
        const response = await fetch("/api/uploads", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok || typeof data.url !== "string") throw new Error(data.error || text.error);
        next.push(data.url);
      }
      onChange(next.slice(0, MAX_IMAGES));
      setMessage(text.done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className="field">
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      hidden
      onChange={(event) => void choose(event.target.files)}
    />
    <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <button
        type="button"
        className="btn secondary"
        disabled={busy || urls.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={17}/>{busy ? text.busy : text.add}
      </button>
      <small className="muted">{urls.length}/{MAX_IMAGES}</small>
    </div>
    <small className="muted">{text.help}</small>
    {urls.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginTop: 12 }}>
      {urls.map((url, index) => <div key={`${url.slice(0,48)}-${index}`} style={{ position: "relative", aspectRatio: "4 / 3" }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, display: "block" }}/>
        <button
          type="button"
          aria-label={text.remove}
          title={text.remove}
          onClick={() => onChange(urls.filter((_, itemIndex) => itemIndex !== index))}
          style={{ position: "absolute", top: 7, right: 7, width: 34, height: 34, border: 0, borderRadius: 999, background: "rgba(5,8,15,.78)", color: "white", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <Trash2 size={16}/>
        </button>
      </div>)}
    </div>}
    {message && <div className="toast" style={{ marginTop: 10 }}>{message}</div>}
  </div>;
}
