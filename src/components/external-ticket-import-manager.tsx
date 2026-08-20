"use client";

import { useMemo, useState } from "react";

type SourceSummary = {
  id: string;
  name: string;
  sourceKey: string;
  platformKey: string | null;
  total: number;
  used: number;
  cancelled: number;
  lastImportedAt: string | null;
};

type Mapping = Partial<Record<"scanCode"|"externalTicketId"|"externalOrderId"|"holderName"|"phone"|"email"|"ticketType"|"price"|"priceMinor"|"currency"|"status", string>>;

type Preview = {
  fileName: string;
  rowCount: number;
  delimiter: string;
  headers: string[];
  detectedMapping: Mapping;
  requiresMapping: boolean;
  sample: Record<string, string>[];
};

type ImportResult = {
  ok: boolean;
  rowCount: number;
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  errorCount: number;
  errors?: Array<{ row: number; error: string }>;
};

const mappingFields: Array<{ key: keyof Mapping; label: string; required?: boolean }> = [
  { key: "scanCode", label: "QR / Barcode", required: true },
  { key: "externalTicketId", label: "ID билета" },
  { key: "externalOrderId", label: "ID заказа" },
  { key: "holderName", label: "Имя покупателя" },
  { key: "phone", label: "Телефон" },
  { key: "email", label: "Email" },
  { key: "ticketType", label: "Тип билета" },
  { key: "price", label: "Цена" },
  { key: "currency", label: "Валюта" },
  { key: "status", label: "Статус" },
];

function platformLabel(value: string | null) {
  if (!value) return "Другая платформа";
  const known: Record<string, string> = { EVENTER: "Eventer", BRAVO: "Bravo", WIX: "Wix", GOOUT: "GoOut", OTHER: "Другая платформа" };
  return known[value.toUpperCase()] || value;
}

export function ExternalTicketImportManager({ eventId, sources }: { eventId: string; sources: SourceSummary[] }) {
  const [selectedSourceId, setSelectedSourceId] = useState(sources[0]?.id || "NEW");
  const selectedSource = useMemo(() => sources.find((source) => source.id === selectedSourceId) || null, [sources, selectedSourceId]);
  const [sourceName, setSourceName] = useState("");
  const [platformKey, setPlatformKey] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const effectiveName = selectedSource?.name || sourceName.trim();
  const importBlockReason = !mapping.scanCode
    ? "Выберите колонку QR / Barcode. Без кода, который реально считывает сканер, Atlas не может безопасно импортировать билеты."
    : !effectiveName
      ? "Укажите название источника билетов."
      : "";

  async function previewFile() {
    if (!file) return setError("Выберите CSV файл");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/office/events/${eventId}/external-tickets/preview`, { method: "POST", body: form });
      const data = await response.json() as Preview & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось прочитать файл");
      setPreview(data);
      setMapping(data.detectedMapping || {});
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Ошибка чтения файла");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file || !preview) return setError("Сначала проверьте файл");
    if (!mapping.scanCode) return setError("Выберите колонку QR / Barcode. Поле ID билета само по себе не считается кодом для сканирования.");
    if (!effectiveName) return setError("Укажите название источника");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("sourceName", effectiveName);
      form.set("platformKey", selectedSource?.platformKey || platformKey);
      if (selectedSource) form.set("sourceKey", selectedSource.sourceKey);
      form.set("mapping", JSON.stringify(mapping));
      const response = await fetch(`/api/office/events/${eventId}/external-tickets/import`, { method: "POST", body: form });
      const data = await response.json() as ImportResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Импорт не выполнен");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack">
    {sources.length > 0 && <section className="panel stack">
      <div><span className="eyebrow">Подключённые источники</span><h2>Продажи мероприятия</h2><p className="muted">Повторная загрузка обновляет существующие билеты и добавляет только новые.</p></div>
      <div className="stats">{sources.map((source) => <div className="stat" key={source.id}><span className="muted">{platformLabel(source.platformKey)}</span><strong>{source.name}</strong><small className="muted">Билетов: {source.total} · вошли: {source.used} · отменены: {source.cancelled}</small>{source.lastImportedAt && <small className="muted">Последний импорт: {new Date(source.lastImportedAt).toLocaleString("ru-RU")}</small>}</div>)}</div>
    </section>}

    <section className="panel stack">
      <div><span className="eyebrow">Импорт</span><h2>Добавить базу продаж</h2><p className="muted">На первом этапе принимаем CSV/TXT. Перед импортом Atlas покажет строки и предложит сопоставление колонок.</p></div>

      {sources.length > 0 && <label>Источник
        <select className="input" value={selectedSourceId} onChange={(event) => { setSelectedSourceId(event.target.value); setPreview(null); setResult(null); }}>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name} · {platformLabel(source.platformKey)}</option>)}
          <option value="NEW">+ Новый источник</option>
        </select>
      </label>}

      {(!sources.length || selectedSourceId === "NEW") && <div className="grid two">
        <label>Платформа
          <select className="input" value={platformKey} onChange={(event) => setPlatformKey(event.target.value)}>
            <option value="EVENTER">Eventer</option><option value="BRAVO">Bravo</option><option value="WIX">Wix</option><option value="GOOUT">GoOut</option><option value="OTHER">Другая</option>
          </select>
        </label>
        <label>Название источника<input className="input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Например Eventer Israel"/></label>
      </div>}

      <label>Файл продаж<input className="input" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setResult(null); setError(""); }}/></label>
      <div className="row"><button className="btn secondary" type="button" disabled={!file || busy} onClick={() => void previewFile()}>{busy ? "Проверяем..." : "Проверить файл"}</button>{file && <span className="muted">{file.name}</span>}</div>

      {error && <div className="toast"><strong>Не удалось продолжить</strong><p>{error}</p></div>}

      {preview && <div className="stack">
        <div className="stats"><div className="stat"><span className="muted">Строк</span><strong>{preview.rowCount}</strong></div><div className="stat"><span className="muted">Разделитель</span><strong>{preview.delimiter}</strong></div><div className="stat"><span className="muted">QR найден автоматически</span><strong>{mapping.scanCode ? "Да" : "Нет"}</strong></div></div>
        <section className="panel stack"><div><span className="eyebrow">Сопоставление</span><h3>Какая колонка что означает</h3></div><div className="grid two">{mappingFields.map((field) => <label key={field.key}>{field.label}{field.required ? " *" : ""}<select className="input" value={mapping[field.key] || ""} onChange={(event) => { setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined })); setError(""); }}><option value="">Не импортировать</option>{preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div></section>
        <div className="table-wrap"><table><thead><tr>{preview.headers.slice(0, 8).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.sample.map((row, index) => <tr key={index}>{preview.headers.slice(0, 8).map((header) => <td key={header}>{row[header] || "-"}</td>)}</tr>)}</tbody></table></div>
        {importBlockReason && <div className="toast"><strong>Перед импортом нужно ещё одно действие</strong><p>{importBlockReason}</p>{!mapping.scanCode && <p className="muted">Если QR на билете действительно содержит значение из колонки «מזהה כרטיס», выберите эту колонку в поле QR / Barcode. Если нет, нужен экспорт Eventer с настоящим Barcode/QR.</p>}</div>}
        <button className="btn" type="button" disabled={busy} onClick={() => void runImport()}>{busy ? "Импортируем..." : importBlockReason ? "Проверить и импортировать" : `Импортировать ${preview.rowCount} билетов`}</button>
      </div>}

      {result && <div className="toast"><strong>Импорт завершён</strong><p>Новых: {result.insertedCount} · обновлено: {result.updatedCount} · ошибок: {result.errorCount}</p>{result.errorCount > 0 && <p className="muted">Первые ошибки: {result.errors?.slice(0, 3).map((item) => `строка ${item.row}: ${item.error}`).join("; ")}</p>}<button className="btn secondary" type="button" onClick={() => window.location.reload()}>Обновить данные</button></div>}
    </section>
  </div>;
}
