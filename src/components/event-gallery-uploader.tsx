"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/components/event-media-manager.module.css";

const MAX_UPLOAD_BYTES = 1_000_000;
const MAX_IMAGES = 6;
const MAX_OUTPUT_WIDTH = 1600;
const TARGET_RATIO = 4 / 3;

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
};

const copy = {
  ru: {
    add: "Загрузить фотографию",
    replace: "Заменить фотографию",
    remove: "Удалить фотографию",
    processing: "Кадрируем фотографию в 4:3…",
    upload: "Загружаем фотографию…",
    done: "Фотография добавлена. Сохраните основные данные.",
    typeError: "Разрешены только JPG, PNG или WebP",
    sizeError: "Исходная фотография должна весить не больше 1 МБ",
    readError: "Не удалось прочитать фотографию",
    processError: "Не удалось подготовить фотографию. Выберите другой файл",
    error: "Не удалось загрузить фотографию",
    count: "Загружено",
  },
  he: {
    add: "העלאת תמונה",
    replace: "החלפת תמונה",
    remove: "מחיקת תמונה",
    processing: "חותך את התמונה ל־4:3…",
    upload: "מעלה תמונה…",
    done: "התמונה נוספה. שמרו את פרטי האירוע.",
    typeError: "ניתן להעלות רק JPG, PNG או WebP",
    sizeError: "משקל קובץ המקור חייב להיות עד 1MB",
    readError: "לא ניתן לקרוא את התמונה",
    processError: "לא ניתן להכין את התמונה. בחרו קובץ אחר",
    error: "לא ניתן להעלות את התמונה",
    count: "הועלו",
  },
  en: {
    add: "Upload photo",
    replace: "Replace photo",
    remove: "Remove photo",
    processing: "Cropping photo to 4:3…",
    upload: "Uploading photo…",
    done: "Photo added. Save the event details.",
    typeError: "Only JPG, PNG or WebP files are allowed",
    sizeError: "The source photo must be no larger than 1 MB",
    readError: "Could not read the photo",
    processError: "Could not prepare the photo. Choose another file",
    error: "Could not upload the photo",
    count: "Uploaded",
  },
} as const;

type Copy = (typeof copy)[keyof typeof copy];

async function loadImage(file: File, text: Copy): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(text.readError));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function cropToFourByThree(file: File, text: Copy): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(text.typeError);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(text.sizeError);

  const image = await loadImage(file, text);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  if (!sourceWidth || !sourceHeight) throw new Error(text.readError);

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > TARGET_RATIO) cropWidth = Math.round(sourceHeight * TARGET_RATIO);
  else if (sourceRatio < TARGET_RATIO) cropHeight = Math.round(sourceWidth / TARGET_RATIO);

  const sourceX = Math.max(0, Math.round((sourceWidth - cropWidth) / 2));
  const sourceY = Math.max(0, Math.round((sourceHeight - cropHeight) / 2));
  const outputWidth = Math.max(4, Math.min(MAX_OUTPUT_WIDTH, cropWidth));
  const outputHeight = Math.max(3, Math.round(outputWidth / TARGET_RATIO));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(text.processError);
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
  if ("close" in image && typeof image.close === "function") image.close();

  let blob: Blob | null = null;
  for (let quality = 0.9; quality >= 0.5; quality -= 0.08) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error(text.processError);
  return new File([blob], "event-gallery-1600x1200.jpg", { type: "image/jpeg" });
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
    setBusy(true);
    setMessage(text.processing);
    try {
      const prepared = await cropToFourByThree(file, text);
      const form = new FormData();
      form.append("image", prepared);
      setMessage(text.upload);
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
      <span>4:3 · до 1600 × 1200 · максимум 1 МБ</span>
    </div>
    {message && <div className={styles.status} role="status">{message}</div>}
  </div>;
}
