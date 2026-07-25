"use client";

import { useRef, useState } from "react";

type Props = {
  initialUrl: string;
};

const MAX_SOURCE_BYTES = 15_000_000;
const MAX_UPLOAD_BYTES = 1_800_000;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 2000;

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
  const scale = Math.min(1, MAX_WIDTH / sourceWidth, MAX_HEIGHT / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не поддерживает обработку изображения");
  context.drawImage(image, 0, 0, width, height);
  if ("close" in image && typeof image.close === "function") image.close();

  let quality = 0.88;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.08;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("Не удалось сжать фотографию. Выберите изображение меньшего размера");
  return new File([blob], "event-poster.jpg", { type: "image/jpeg" });
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
      <label>Главная фотография мероприятия</label>
      <input type="hidden" name="posterUrl" value={url} />
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void choose(event.target.files?.[0])} />
      <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Обработка…" : url ? "Заменить фотографию" : "Загрузить фотографию"}
        </button>
        <small className="muted">JPG, PNG или WebP · до 15 МБ</small>
      </div>
      <small className="muted">Рекомендуемый размер: 1600 × 2000 px, вертикальный формат 4:5. Система сама уменьшит и сожмёт большой файл.</small>
      {message && <div className="toast" style={{ marginTop: 10 }}>{message}</div>}
      {url && <img src={url} alt="Текущая афиша" style={{ width: "min(420px,100%)", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 16, marginTop: 12 }} />}
    </div>
  );
}
