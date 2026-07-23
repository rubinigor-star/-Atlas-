"use client";

import { useState } from "react";

type Props = {
  eventId: string;
  categories: Array<{ id: string; name: string; priceMinor: number }>;
  tables: Array<{ id: string; label: string; seats: number; categoryId: string | null }>;
};

export function GuestLinkManager({ eventId, categories, tables }: Props) {
  const freeCategories = categories.filter((item) => item.priceMinor === 0);
  const freeCategoryIds = new Set(freeCategories.map((item) => item.id));
  const freeTables = tables.filter((item) => item.categoryId && freeCategoryIds.has(item.categoryId));
  const [type, setType] = useState<"CATEGORY" | "TABLE">(freeTables.length ? "TABLE" : "CATEGORY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ publicPath: string; managePath: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/guest-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        displayName: form.get("displayName"),
        allocationType: type,
        categoryId: type === "CATEGORY" ? form.get("categoryId") : null,
        tableId: type === "TABLE" ? form.get("tableId") : null,
        guestLimit: Number(form.get("guestLimit")),
        code: form.get("code") || undefined,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error || "Не удалось создать ссылку");
    setResult({ publicPath: data.publicPath, managePath: data.managePath });
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return <section className="panel form">
    <span className="eyebrow">Гостевой список</span>
    <h2>Создать ссылку без аккаунта</h2>
    <p className="muted">Именинник или ответственный человек сможет самостоятельно добавлять гостей. Для такого списка используется билет с ценой 0.</p>
    {!freeCategories.length ? <div className="toast">Сначала создайте билет с ценой 0.</div> : <form onSubmit={submit} className="form">
      <div className="field"><label>Название списка</label><input className="input" name="displayName" required placeholder="День рождения Васи" /></div>
      <div className="field"><label>Короткий код ссылки — необязательно</label><input className="input" name="code" pattern="[A-Za-z0-9_-]{3,40}" placeholder="VASYA" /></div>
      <div className="pricing-switch"><button type="button" className={type === "TABLE" ? "active" : ""} disabled={!freeTables.length} onClick={() => setType("TABLE")}>Конкретный стол</button><button type="button" className={type === "CATEGORY" ? "active" : ""} onClick={() => setType("CATEGORY")}>Бесплатный билет</button></div>
      {type === "TABLE" ? <div className="field"><label>Стол</label><select name="tableId" required>{freeTables.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.seats} мест</option>)}</select></div> : <div className="field"><label>Билет</label><select name="categoryId" required>{freeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
      <div className="field"><label>Максимальное количество гостей</label><input className="input" name="guestLimit" type="number" min="1" max="500" required defaultValue={type === "TABLE" ? freeTables[0]?.seats ?? 10 : 10} /></div>
      {error && <div className="toast">{error}</div>}
      <button className="btn" disabled={busy}>{busy ? "Создаём..." : "Создать гостевую ссылку"}</button>
    </form>}
    {result && <div className="panel" style={{ marginTop: 16 }}><strong>Ссылки созданы</strong><p className="muted">Основную ссылку можно отправить гостям для просмотра. Ссылку управления отправьте Васе — по ней он сможет добавлять и удалять гостей.</p><div className="field"><label>Ссылка управления</label><input className="input" readOnly value={`${origin}${result.managePath}`} onFocus={(e) => e.currentTarget.select()} /></div><div className="field"><label>Публичная ссылка</label><input className="input" readOnly value={`${origin}${result.publicPath}`} onFocus={(e) => e.currentTarget.select()} /></div></div>}
  </section>;
}
