"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PromoterManager({ events, promoters }: { events: Array<{ id: string; title: string; categories: Array<{ id: string; name: string }>; tables: Array<{ id: string; label: string }> }>; promoters: Array<{ id: string; name: string; defaultCommissionBps: number }> }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [allocationType, setAllocationType] = useState<"EVENT" | "CATEGORY" | "TABLE">("TABLE");
  const event = events.find((item) => item.id === eventId);

  async function send(payload: unknown) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/promoters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error || "Ошибка");
    router.refresh();
  }

  return <div className="promoter-manager">
    <div className="panel form">
      <h2>Новый промоутер</h2>
      <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: "promoter", name: f.get("name"), email: f.get("email"), phone: f.get("phone"), commissionPercent: Number(f.get("commission") || 0) }); e.currentTarget.reset(); }}>
        <div className="field"><label>Имя</label><input className="input" name="name" required minLength={2} /></div>
        <div className="field"><label>Email</label><input className="input" name="email" type="email" /></div>
        <div className="field"><label>Телефон</label><input className="input" name="phone" /></div>
        <div className="field"><label>Комиссия по умолчанию, %</label><input className="input" name="commission" type="number" min="0" max="100" step="0.01" defaultValue="0" /></div>
        <button className="btn" disabled={busy}>Добавить промоутера</button>
      </form>
    </div>

    <div className="panel form">
      <h2>Новая ссылка продаж</h2>
      <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: "link", eventId, promoterId: f.get("promoterId"), label: f.get("label"), code: String(f.get("code") || "").toUpperCase(), allocationType, categoryId: allocationType === "CATEGORY" ? f.get("categoryId") : null, tableId: allocationType === "TABLE" ? f.get("tableId") : null, guestLimit: f.get("guestLimit") ? Number(f.get("guestLimit")) : null, maxPerOrder: Number(f.get("maxPerOrder") || 10), customPriceMinor: f.get("price") ? Math.round(Number(f.get("price")) * 100) : null, commissionPercent: Number(f.get("commission") || 0), exclusive: f.get("exclusive") === "on" }); }}>
        <div className="field"><label>Мероприятие</label><select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></div>
        <div className="field"><label>Промоутер</label><select name="promoterId" required>{promoters.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label>Название ссылки</label><input className="input" name="label" required placeholder="Стол 12 — Алекс" /></div>
        <div className="field"><label>Код ссылки</label><input className="input" name="code" required pattern="[A-Za-z0-9_-]{3,40}" placeholder="ALEX-T12" /></div>
        <div className="field"><label>Что продаёт ссылка</label><select value={allocationType} onChange={(e) => setAllocationType(e.target.value as typeof allocationType)}><option value="TABLE">Конкретный стол / объект</option><option value="CATEGORY">Категория билетов</option><option value="EVENT">Всё мероприятие</option></select></div>
        {allocationType === "TABLE" && <div className="field"><label>Стол / объект</label><select name="tableId" required>{event?.tables.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div>}
        {allocationType === "CATEGORY" && <div className="field"><label>Категория</label><select name="categoryId" required>{event?.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>}
        <div className="field"><label>Квота гостей</label><input className="input" name="guestLimit" type="number" min="1" placeholder="Без ограничения" /></div>
        <div className="field"><label>Максимум в одном заказе</label><input className="input" name="maxPerOrder" type="number" min="1" max="50" defaultValue="10" /></div>
        <div className="field"><label>Специальная цена, ₪</label><input className="input" name="price" type="number" min="0.01" step="0.01" placeholder="Оставить обычную" /></div>
        <div className="field"><label>Комиссия, %</label><input className="input" name="commission" type="number" min="0" max="100" step="0.01" defaultValue="0" /></div>
        <label className="row"><input name="exclusive" type="checkbox" defaultChecked /> Эксклюзивно закрепить выбранный инвентарь за этой ссылкой</label>
        {error && <div className="toast">{error}</div>}
        <button className="btn" disabled={busy || !promoters.length || !events.length}>Создать ссылку</button>
      </form>
    </div>
  </div>;
}
