"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/components/event-media-manager.module.css";

type Props = {
  initialUrl: string;
};

const MAX_SOURCE_BYTES = 15_000_000;
const MAX_UPLOAD_BYTES = 1_200_000;
const OUTPUT_SIZE = 750;

const copy = {
  ru: {
    empty: "Главная афиша не загружена",
    add: "Загрузить или заменить главную афишу",
    optimizing: "Оптимизируем афишу…",
    uploading: "Загружаем афишу…",
    done: "Афиша загружена. Сохраните основные данные.",
    typeError: "Выберите JPG, PNG или WebP",
    sourceError: "Исходный файл должен быть не больше 15 МБ",
    readError: "Не удалось прочитать изображение",
    browserError: "Браузер не поддерживает обработку изображения",
    compressError: "Не удалось оптимизировать афишу. Выберите файл меньшего размера",
    uploadError: "Не удалось загрузить афишу",
  },
  he: {
    empty: "הכרזה הראשית עדיין לא הועלתה",
    add: "העלאה או החלפה של הכרזה הראשית",
    optimizing: "מבצע אופטימיזציה לכרזה…",
    uploading: "מעלה את הכרזה…",
    done: "הכרזה הועלתה. שמרו את פרטי האירוע.",
    typeError: "יש לבחור JPG, PNG או WebP",
    sourceError: "גודל קובץ המקור חייב להיות עד 15MB",
    readError: "לא ניתן לקרוא את התמונה",
    browserError: "הדפדפן אינו תומך בעיבוד התמונה",
    compressError: "לא ניתן לבצע אופטימיזציה. בחרו קובץ קטן יותר",
    uploadError: "לא ניתן להעלות את הכרזה",
  },
  en: {
    empty: "No main poster uploaded",
    add: "Upload or replace the main poster",
    optimizing: "Optimizing poster…",
    uploading: "Uploading poster…",
    done: "Poster uploaded. Save the event details.",
    typeError: "Choose a JPG, PNG or WebP file",
    sourceError: "The source file must be no larger than 15 MB",
    readError: "Could not read the image",
    browserError: "This browser cannot process the image",
    compressError: "Could not optimize the poster. Choose a smaller file",
    uploadError: "Could not upload the poster",
  },
} as const;

async function loadImage(file: File, readError: string): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(readError));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function optimizePoster(file: File, text: (typeof copy)[keyof typeof copy]): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(text.typeError);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(text.sourceError);

  const image = await loadImage(file, text.readError);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, Math.round((sourceWidth - cropSize) / 2));
  const sourceY = Math.max(0, Math.round((sourceHeight - cropSize) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(text.browserError);
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  if ("close" in image && typeof image.close === "function") image.close();

  let quality = 0.9;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.08;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error(text.compressError);
  return new File([blob], "event-poster-750x750.jpg", { type: "image/jpeg" });
}

export function PosterUploader({ initialUrl }: Props) {
  const { locale } = useLocale();
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function choose(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setMessage(text.optimizing);
    try {
      const optimized = await optimizePoster(file, text);
      const form = new FormData();
      form.append("poster", optimized);
      setMessage(text.uploading);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || text.uploadError);
      setUrl(data.url);
      setMessage(text.done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.uploadError);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className={styles.uploaderBody}>
    <input type="hidden" name="posterUrl" value={url}/>
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onChange={(event) => void choose(event.target.files?.[0])}
    />
    <div className={styles.posterFrame}>
      {url
        ? <img src={url} alt=""/>
        : <div className={styles.emptyFrame}><span><ImagePlus size={30}/><br/>{text.empty}</span></div>}
      <button
        type="button"
        className={styles.addButton}
        aria-label={text.add}
        title={text.add}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Plus size={24}/>
      </button>
    </div>
    {message && <div className={styles.status} role="status">{message}</div>}
  </div>;
}
