"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/components/event-media-manager.module.css";

const MAX_UPLOAD_BYTES = 1_000_000;
const MAX_IMAGES = 6;

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
};

const copy = {
  ru: {
    add: "Загрузить фотографию",
    replace: "Заменить фотографию",
    remove: "Удалить фотографию",
    upload: "Загружаем фотографию…",
    done: "Фотография добавлена. Сохраните основные данные.",
    typeError: "Разрешены только JPG, PNG или WebP",
    sizeError: "Фотография должна весить не больше 1 МБ",
    error: "Не удалось загрузить фотографию",
    count: "Загружено",
  },
  he: {
    add: "העלאת תמונה",
    replace: "החלפת תמונה",
    remove: "מחיקת תמונה",
    upload: "מעלה תמונה…",
    done: "התמונה נוספה. שמרו את פרטי האירוע.",
    typeError: "ניתן להעלות רק JPG, PNG או WebP",
    sizeError: "משקל התמונה חייב להיות עד 1MB",
    error: "לא ניתן להעלות את התמונה",
    count: "הועלו",
  },
  en: {
    add: "Upload photo",
    replace: "Replace photo",
    remove: "Remove photo",
    upload: "Uploading photo…",
    done: "Photo added. Save the event details.",
    typeError: "Only JPG, PNG or WebP files are allowed",
    sizeError: "The photo must be no larger than 1 MB",
    error: "Could not upload the photo",
    count: "Uploaded",
  },
} as const;

function validateImage(file: File, text: (typeof copy)[keyof typeof copy]) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(text.typeError);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(text.sizeError);
}

export function EventGalleryUploader({ urls, onChange }: Props) {
  const { locale } = useLocale();
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function openPicker(index: number) {
    if (busy) return;
    setActiveIndex(index);
    inputRef.current?.click();
  }

  async function choose(file?: File) {
    if (!file || busy) return;
    try {
      validateImage(file, text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    setMessage(text.upload);
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || text.error);

      const next = [...urls];
      if (activeIndex < next.length) next[activeIndex] = data.url;
      else next.push(data.url);
      onChange(next.slice(0, MAX_IMAGES));
      setMessage(text.done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className={styles.uploaderBody}>
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onChange={(event) => void choose(event.target.files?.[0])}
    />

    <div className={styles.galleryGrid}>
      {Array.from({ length: MAX_IMAGES }, (_, index) => {
        const url = urls[index];
        const addLabel = url ? text.replace : text.add;
        return <div key={index} className={`${styles.gallerySlot} ${url ? styles.hasImage : ""}`}>
          {url && <img src={url} alt=""/>}
          <button
            type="button"
            className={styles.slotAddButton}
            aria-label={addLabel}
            title={addLabel}
            disabled={busy}
            onClick={() => openPicker(index)}
          >
            <Plus size={url ? 18 : 28}/>
          </button>
          {url && <button
            type="button"
            className={styles.removeButton}
            aria-label={text.remove}
            title={text.remove}
            disabled={busy}
            onClick={() => onChange(urls.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 size={15}/>
          </button>}
        </div>;
      })}
    </div>

    <div className={styles.galleryMeta}>
      <span>{text.count}: {urls.length}/{MAX_IMAGES}</span>
      <span>JPG · PNG · WebP</span>
    </div>
    {message && <div className={styles.status} role="status">{message}</div>}
  </div>;
}
