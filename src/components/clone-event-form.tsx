"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SourceEvent = {
  id: string;
  title: string;
  startsAt: string;
  venueName: string;
  city: string;
  address: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function CloneEventForm({ events }: { events: SourceEvent[] }) {
  const router = useRouter();
  const [sourceEventId, setSourceEventId] = useState(events[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const source = useMemo(
    () => events.find((event) => event.id === sourceEventId) ?? events[0],
    [events, sourceEventId],
  );

  if (!events.length) return <div className="toast">Сначала создайте хотя бы одно мероприятие.</div>;

  const sourceStart = new Date(source.startsAt);
  const suggestedStart = new Date(sourceStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const suggestedDoors = new Date(suggestedStart.getTime() - 60 * 60 * 1000);
  const suggestedSalesStart = new Date();
  const suggestedSalesEnd = new Date(suggestedStart.getTime() - 30 * 60 * 1000);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const date = (name: string) => {
        const value = String(form.get(name) || "");
        if (!value) throw new Error("Заполните все даты");
        return new Date(value).toISOString();
      };

      const response = await fetch("/api/admin/events/clone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceEventId,
          title,
          slug,
          startsAt: date("startsAt"),
          doorsOpenAt: date("doorsOpenAt"),
          salesStart: date("salesStart"),
          salesEnd: date("salesEnd"),
          venueName: form.get("venueName"),
          city: form.get("city"),
          address: form.get("address"),
          copyGuestLists: form.get("copyGuestLists") === "on",
          copyPromoters: form.get("copyPromoters") === "on",
          copyPromoCodes: form.get("copyPromoCodes") === "on",
          copyReferralLinks: form.get("copyReferralLinks") === "on",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось скопировать мероприятие");

      router.push(`/office/events/${data.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось скопировать мероприятие");
      setBusy(false);
    }
  }

  return (
    <form className={`panel form ${busy ? "loading" : ""}`} onSubmit={submit}>
      <h2>Скопировать существующее мероприятие</h2>
      <p className="muted">
        Копия создаётся как черновик. Заказы, оплаты, билеты, резервы, продажи, посещения ссылок и сканирования не переносятся.
      </p>

      <div className="field">
        <label>Исходное мероприятие</label>
        <select value={sourceEventId} onChange={(event) => setSourceEventId(event.target.value)} required>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {new Date(item.startsAt).toLocaleDateString("ru-RU")}
            </option>
          ))}
        </select>
      </div>

      <div className="panel" style={{ background: "#f8fafc" }}>
        <strong>Будет скопировано</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          Категории и цены, тарифные периоды, анкета гостя, карта зала, зоны, столы, места, дизайн билета и выбранные ниже ссылки.
        </p>
      </div>

      <div className="form-grid two">
        <div className="field">
          <label>Новое название</label>
          <input
            className="input"
            name="title"
            value={title}
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              if (!slugTouched) setSlug(slugify(nextTitle));
            }}
            required
          />
        </div>
        <div className="field">
          <label>Новый адрес страницы</label>
          <input
            className="input"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            pattern="[a-z0-9-]+"
            placeholder="event-name-2026"
            required
          />
        </div>
      </div>

      <div className="form-grid two">
        <div className="field">
          <label>Начало мероприятия</label>
          <input className="input" type="datetime-local" name="startsAt" defaultValue={localDateTime(suggestedStart)} required />
        </div>
        <div className="field">
          <label>Открытие дверей</label>
          <input className="input" type="datetime-local" name="doorsOpenAt" defaultValue={localDateTime(suggestedDoors)} required />
        </div>
      </div>

      <div className="form-grid two">
        <div className="field">
          <label>Начало продаж</label>
          <input className="input" type="datetime-local" name="salesStart" defaultValue={localDateTime(suggestedSalesStart)} required />
        </div>
        <div className="field">
          <label>Окончание продаж</label>
          <input className="input" type="datetime-local" name="salesEnd" defaultValue={localDateTime(suggestedSalesEnd)} required />
        </div>
      </div>

      <div className="form-grid two">
        <div className="field">
          <label>Площадка</label>
          <input key={`venue-${source.id}`} className="input" name="venueName" defaultValue={source.venueName} required />
        </div>
        <div className="field">
          <label>Город</label>
          <input key={`city-${source.id}`} className="input" name="city" defaultValue={source.city} required />
        </div>
      </div>

      <div className="field">
        <label>Адрес</label>
        <input key={`address-${source.id}`} className="input" name="address" defaultValue={source.address} required />
      </div>

      <label className="option">
        <span>
          <strong>Скопировать гостевые списки</strong>
          <small>Названия, категории, столы и лимиты сохранятся; для нового события будут созданы новые ссылки.</small>
        </span>
        <input type="checkbox" name="copyGuestLists" defaultChecked />
      </label>

      <label className="option">
        <span>
          <strong>Скопировать ссылки промоутеров</strong>
          <small>Промоутеры, комиссии, квоты, специальные цены и назначения сохранятся с новыми кодами.</small>
        </span>
        <input type="checkbox" name="copyPromoters" defaultChecked />
      </label>

      <label className="option">
        <span>
          <strong>Скопировать промокоды</strong>
          <small>Коды, скидки и активность сохранятся; статистика использования не переносится.</small>
        </span>
        <input type="checkbox" name="copyPromoCodes" defaultChecked />
      </label>

      <label className="option">
        <span>
          <strong>Скопировать реферальные ссылки</strong>
          <small>Названия сохранятся, но система выпустит новые уникальные коды без старых заказов и переходов.</small>
        </span>
        <input type="checkbox" name="copyReferralLinks" defaultChecked />
      </label>

      {error && <div className="toast">{error}</div>}
      <button className="btn" disabled={busy}>
        {busy ? "Копируем мероприятие..." : "Создать копию мероприятия"}
      </button>
    </form>
  );
}
