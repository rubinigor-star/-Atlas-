"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const TARGET_RATIO = 4 / 3;
const RATIO_TOLERANCE = 0.01;
const MAX_UPLOAD_BYTES = 1_000_000;
const MAX_IMAGES = 6;

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
};

const copy = {
  ru: {
    add: "Добавить фотографии 4:3",
    busy: "Загрузка…",
    help: "До 6 фотографий. Горизонтальный формат 4:3. Рекомендуемый размер: 1600 × 1200 px. Максимальный вес каждой фотографии: 1 МБ. Файл загружается без обрезки и изменения размера.",
    remove: "Удалить фотографию",
    checking: "Проверяем формат фотографий…",
    upload: "Загружаем фотографии…",
    done: "Фотографии добавлены. Нажмите «Сохранить основные данные».",
    typeError: "Разрешены только JPG, PNG или WebP",
    sizeError: "Каждая фотография должна весить не больше 1 МБ",
    ratioError: "Фотография должна иметь горизонтальную пропорцию 4:3, например 1600 × 1200 px",
    readError: "Не удалось прочитать фотографию",
    error: "Не удалось загрузить фотографию",
  },
  he: {
    add: "הוספת תמונות 4:3",
    busy: "מעלה…",
    help: "עד 6 תמונות בפורמט אופקי 4:3. גודל מומלץ: 1600 × 1200 פיקסלים. משקל מרבי לכל תמונה: 1MB. הקובץ עולה ללא חיתוך וללא שינוי גודל.",
    remove: "מחיקת תמונה",
    checking: "בודק את פורמט התמונות…",
    upload: "מעלה תמונות…",
    done: "התמונות נוספו. לחצו על שמירת פרטי האירוע.",
    typeError: "ניתן להעלות רק JPG, PNG או WebP",
    sizeError: "משקל כל תמונה חייב להיות עד 1MB",
    ratioError: "התמונה חייבת להיות אופקית ביחס 4:3, לדוגמה 1600 × 1200 פיקסלים",
    readError: "לא ניתן לקרוא את התמונה",
    error: "לא ניתן להעלות את התמונה",
  },
  en: {
    add: "Add 4:3 photos",
    busy: "Uploading…",
    help: "Up to 6 horizontal 4:3 photos. Recommended size: 1600 × 1200 px. Maximum file size: 1 MB per photo. Files are uploaded without cropping or resizing.",
    remove: "Remove photo",
    checking: "Checking photo format…",
    upload: "Uploading photos…",
    done: "Photos added. Save the event details to apply them.",
    typeError: "Only JPG, PNG or WebP files are allowed",
    sizeError: "Each photo must be no larger than 1 MB",
    ratioError: "The photo must use a horizontal 4:3 ratio, for example 1600 × 1200 px",
    readError: "Could not read the photo",
    error: "Could not upload the photo",
  },
} as const;

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  if ("createImageBitmap" in window) {
    const image = await createImageBitmap(file);
    const dimensions = { width: image.width, height: image.height };
    image.close();
    return dimensions;
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Could not read image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function validateImage(file: File, text: (typeof copy)[keyof typeof copy]): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(text.typeError);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(text.sizeError);

  let dimensions: { width: number; height: number };
  try {
    dimensions = await readDimensions(file);
  } catch {
    throw new Error(text.readError);
  }

  if (!dimensions.width || !dimensions.height) throw new Error(text.readError);
  const ratio = dimensions.width / dimensions.height;
  if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE) throw new Error(text.ratioError);

  return file;
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
    setMessage(text.checking);
    try {
      const next = [...urls];
      for (const file of selected) {
        const validated = await validateImage(file, text);
        const form = new FormData();
        form.append("image", validated);
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
      {urls.map((url, index) => <div key={`${url.slice(0,48)}-${index}`} style={{ position: "relative", aspectRatio: "4 / 3", background: "#eef0f4", borderRadius: 14, overflow: "hidden" }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 14, display: "block" }}/>
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
