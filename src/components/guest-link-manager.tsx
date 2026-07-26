"use client";

import { useState } from "react";

type GuestLink = { id: string; label: string; code: string; guestLimit: number | null; publicPath: string; managePath: string };
type Props = {
  eventId: string;
  categories: Array<{ id: string; name: string; priceMinor: number }>;
  tables: Array<{ id: string; label: string; seats: number; categoryId: string | null }>;
  existingLinks: GuestLink[];
};

export function GuestLinkManager({ eventId, categories, tables, existingLinks }: Props) {
  const freeCategories = categories.filter((item) => item.priceMinor === 0);
  const freeCategoryIds = new Set(freeCategories.map((item) => item.id));
  const freeTables = tables.filter((item) => item.categoryId && freeCategoryIds.has(item.categoryId));
  const [type, setType] = useState<"CATEGORY" | "TABLE">(freeTables.length ? "TABLE" : "CATEGORY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [result, setResult] = useState<{ publicPath: string; managePath: string } | null>(null);

  async function copyValue(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1600);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/guest-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, displayName: form.get("displayName"), allocationType: type, categoryId: type === "CATEGORY" ? form.get("categoryId") : null, tableId: type === "TABLE" ? form.get("tableId") : null, guestLimit: Number(form.get("guestLimit")), code: form.get("code") || undefined }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error || "Не удалось создать канал");
    setResult({ publicPath: data.publicPath, managePath: data.managePath });
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const CopyRow = ({ label, value, copyKey }: { label: string; value: string; copyKey: string }) => <div className="field"><label>{label}</label><div className="row" style={{gap:8}}><input className="input" readOnly value={value} onFocus={(e) => e.currentTarget.select()} /><button type="button" className="btn secondary" onClick={() => void copyValue(value, copyKey)}>{copied === copyKey ? "Скопировано" : "Копировать"}</button></div></div>;

  return <section className="panel form">
    <span className="eyebrow">Ссылки и источники</span>
    <h2>Каналы продаж</h2>
    <p className="muted">Создавайте отдельные ссылки для гостей, дней рождения, друзей и других источников. Следующим этапом здесь появятся рекламные каналы Facebook, Instagram и партнёрские ссылки с кликами, продажами и конверсией.</p>
    {existingLinks.length > 0 && <div className="form" style={{marginBottom:24}}>{existingLinks.map((link) => <details className="panel" key={link.id}><summary><strong>{link.label}</strong> · лимит {link.guestLimit ?? "—"}</summary><div style={{marginTop:14}}><CopyRow label="Ссылка управления" value={`${origin}${link.managePath}`} copyKey={`${link.id}-manage`} /><CopyRow label="Публичная ссылка" value={`${origin}${link.publicPath}`} copyKey={`${link.id}-public`} /></div></details>)}</div>}
    <h3>Создать канал гостевого доступа</h3>
    <p className="muted">Подходит для дня рождения, VIP-списка, друга или ответственного человека. Он сможет добавлять гостей без аккаунта. Для такого канала используется категория билета с ценой 0.</p>
    {!freeCategories.length ? <div className="toast">Сначала создайте бесплатную категорию билета с ценой 0 ₪.</div> : <form onSubmit={submit} className="form">
      <div className="field"><label>Название канала</label><input className="input" name="displayName" required placeholder="День рождения Васи / VIP friends" /></div>
      <div className="field"><label>Короткий код ссылки - необязательно</label><input className="input" name="code" pattern="[A-Za-z0-9_-]{3,40}" placeholder="VASYA" /></div>
      <div className="pricing-switch"><button type="button" className={type === "TABLE" ? "active" : ""} disabled={!freeTables.length} onClick={() => setType("TABLE")}>Конкретный стол</button><button type="button" className={type === "CATEGORY" ? "active" : ""} onClick={() => setType("CATEGORY")}>Категория бесплатных билетов</button></div>
      {type === "TABLE" ? <div className="field"><label>Стол</label><select name="tableId" required>{freeTables.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.seats} мест</option>)}</select></div> : <div className="field"><label>Категория билета</label><select name="categoryId" required>{freeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
      <div className="field"><label>Лимит приглашённых</label><input className="input" name="guestLimit" type="number" min="1" max="500" required defaultValue={type === "TABLE" ? freeTables[0]?.seats ?? 10 : 10} /></div>
      {error && <div className="toast">{error}</div>}
      <button className="btn" disabled={busy}>{busy ? "Создаём..." : "Создать канал"}</button>
    </form>}
    {result && <div className="panel" style={{ marginTop: 16 }}><strong>✓ Канал создан</strong><p className="muted">Публичную ссылку можно отправлять гостям. Ссылку управления передайте ответственному человеку.</p><CopyRow label="Ссылка управления" value={`${origin}${result.managePath}`} copyKey="new-manage" /><CopyRow label="Публичная ссылка" value={`${origin}${result.publicPath}`} copyKey="new-public" /></div>}
  </section>;
}
