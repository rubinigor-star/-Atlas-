"use client";

import { useRef, useState } from "react";

type Props = {
  initialUrl: string;
};

const MAX_SOURCE_BYTES = 15_000_000;
const MAX_UPLOAD_BYTES = 1_200_000;
const OUTPUT_SIZE = 750;

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

async function optimizePoster(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Выберите JPG, PNG или WebP");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Исходный файл должен быть не больше 15 МБ");

  const image = await loadImage(file);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, Math.round((sourceWidth - cropSize) / 2));
  const sourceY = Math.max(0, Math.round((sourceHeight - cropSize) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не поддерживает обработку изображения");
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  if ("close" in image && typeof image.close === "function") image.close();

  let quality = 0.9;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.08;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("Не удалось сжать фотографию. Выберите изображение меньшего размера");
  return new File([blob], "event-poster-750x750.jpg", { type: "image/jpeg" });
}

export function PosterUploader({ initialUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("Оптимизируем фотографию…");
    try {
      const optimized = await optimizePoster(file);
      const form = new FormData();
      form.append("poster", optimized);
      setMessage("Загружаем фотографию…");
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить фотографию");
      setUrl(data.url);
      setMessage("Фотография загружена. Нажмите «Сохранить», чтобы применить её к мероприятию.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="field">
      <label>Главная афиша мероприятия</label>
      <input type="hidden" name="posterUrl" value={url} />
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void choose(event.target.files?.[0])} />
      <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Обработка…" : url ? "Заменить фотографию" : "Загрузить фотографию"}
        </button>
        <small className="muted">JPG, PNG или WebP · исходный файл до 15 МБ</small>
      </div>
      <small className="muted">Главная афиша всегда квадратная: 750 × 750 px. Изображение автоматически обрезается по центру до квадрата и оптимизируется. Дополнительные фотографии галереи загружаются отдельно в формате 4:3.</small>
      {message && <div className="toast" style={{ marginTop: 10 }}>{message}</div>}
      {url && <img src={url} alt="Текущая афиша" style={{ width: "min(420px,100%)", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 16, marginTop: 12 }} />}
    </div>
  );
}
