"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

const MAX_ITEMS = 6;
const MAX_SOURCE_BYTES = 15_000_000;
const MAX_IMAGE_BYTES = 220_000;
const SIZE = 750;

const copy = {
  ru: {
    enable: "Добавить изображения в галерею",
    help: "До 6 изображений. Рекомендуемый и итоговый формат: 750 × 750 px.",
    upload: "Загрузить изображения",
    busy: "Обработка…",
    remove: "Удалить",
    optimizing: "Оптимизируем изображения…",
    uploading: "Загружаем изображения…",
    done: "Галерея подготовлена. Нажмите «Сохранить основные данные».",
    limit: "Можно добавить не больше 6 изображений.",
  },
  he: {
    enable: "הוספת תמונות לגלריה",
    help: "עד 6 תמונות. גודל מומלץ וסופי: 750 × 750 פיקסלים.",
    upload: "העלאת תמונות",
    busy: "מעבד…",
    remove: "מחיקה",
    optimizing: "מעבד את התמונות…",
    uploading: "מעלה את התמונות…",
    done: "הגלריה מוכנה. לחצו על שמירת פרטי האירוע.",
    limit: "אפשר להוסיף עד 6 תמונות.",
  },
  en: {
    enable: "Add images to the gallery",
    help: "Up to 6 images. Recommended and final format: 750 × 750 px.",
    upload: "Upload images",
    busy: "Processing…",
    remove: "Remove",
    optimizing: "Optimizing images…",
    uploading: "Uploading images…",
    done: "The gallery is ready. Click Save event details.",
    limit: "You can add up to 6 images.",
  },
} as const;

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function optimizeSquare(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Выберите JPG, PNG или WebP");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Исходный файл должен быть не больше 15 МБ");
  const image = await loadImage(file);
  const side = Math.min(image.width, image.height);
  const sx = Math.max(0, Math.round((image.width - side) / 2));
  const sy = Math.max(0, Math.round((image.height - side) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не поддерживает обработку изображения");
  context.drawImage(image, sx, sy, side, side, 0, 0, SIZE, SIZE);
  if ("close" in image && typeof image.close === "function") image.close();

  let quality = 0.86;
  let blob: Blob | null = null;
  while (quality >= 0.38) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_IMAGE_BYTES) break;
    quality -= 0.07;
  }
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error("Не удалось оптимизировать изображение");
  return new File([blob], "event-gallery.jpg", { type: "image/jpeg" });
}

export function EventGalleryUploader({ initialUrls }: { initialUrls: string[] }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [enabled, setEnabled] = useState(initialUrls.length > 0);
  const [urls, setUrls] = useState(initialUrls.slice(0, MAX_ITEMS));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function choose(files?: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_ITEMS - urls.length;
    if (remaining <= 0) {
      setMessage(text.limit);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    setBusy(true);
    setEnabled(true);
    setMessage(text.optimizing);
    try {
      const next: string[] = [];
      for (const file of selected) {
        const optimized = await optimizeSquare(file);
        const form = new FormData();
        form.append("image", optimized);
        setMessage(text.uploading);
        const response = await fetch("/api/uploads", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить изображение");
        next.push(data.url);
      }
      setUrls((current) => [...current, ...next].slice(0, MAX_ITEMS));
      setMessage(text.done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className="field event-gallery-uploader">
    <input type="hidden" name="galleryEnabled" value={enabled ? "true" : "false"}/>
    <input type="hidden" name="galleryUrlsJson" value={JSON.stringify(urls)}/>
    <label className="check-row">
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/>
      <span><strong>{text.enable}</strong><small>{text.help}</small></span>
    </label>
    {enabled && <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => void choose(event.target.files)}/>
      <button type="button" className="btn secondary" disabled={busy || urls.length >= MAX_ITEMS} onClick={() => inputRef.current?.click()}>
        {busy ? text.busy : text.upload}
      </button>
      {urls.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(112px,1fr))", gap: 10, marginTop: 12 }}>
        {urls.map((url, index) => <div key={`${url.slice(0, 60)}-${index}`} style={{ position: "relative" }}>
          <img src={url} alt="" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12 }}/>
          <button type="button" aria-label={text.remove} onClick={() => setUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, border: 0, borderRadius: 999, background: "rgba(0,0,0,.72)", color: "#fff", cursor: "pointer" }}>×</button>
        </div>)}
      </div>}
    </>}
    {message && <small className="muted" style={{ display: "block", marginTop: 9 }}>{message}</small>}
  </div>;
}