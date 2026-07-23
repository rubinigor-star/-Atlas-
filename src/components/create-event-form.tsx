"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdmissionMode = "GENERAL_ADMISSION" | "RESERVED_SEATING";
type PricingMode = "FIXED" | "SCHEDULED";

export function CreateEventForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>("GENERAL_ADMISSION");
  const [pricingMode, setPricingMode] = useState<PricingMode>("FIXED");
  const [salesMode, setSalesMode] = useState<"INSTANT" | "APPROVAL_REQUIRED">("INSTANT");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let posterUrl = "/assets/noa-live-tel-aviv.png";
    const poster = form.get("poster");
    if (poster instanceof File && poster.size) {
      const upload = new FormData();
      upload.set("poster", poster);
      const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) { setError(uploadData.error); setBusy(false); return; }
      posterUrl = uploadData.url;
    }

    const date = (name: string) => new Date(String(form.get(name))).toISOString();
    const payload = {
      title: form.get("title"), slug: form.get("slug"), description: form.get("description"),
      startsAt: date("startsAt"), doorsOpenAt: date("doorsOpenAt"), venueName: form.get("venueName"), city: form.get("city"), address: form.get("address"),
      mapEnabled: admissionMode === "RESERVED_SEATING", salesMode,
      approvalInstructions: form.get("approvalInstructions"), posterUrl,
      categoryName: form.get("categoryName"), categoryDescription: form.get("categoryDescription"),
      categoryColor: form.get("categoryColor"),
      priceMinor: Math.round(Number(form.get("price")) * 100), capacity: Number(form.get("capacity")),
      pricingMode, salesStart: date("salesStart"), salesEnd: date("salesEnd"),
      earlyBirdPriceMinor: pricingMode === "SCHEDULED" ? Math.round(Number(form.get("earlyBirdPrice")) * 100) : undefined,
      earlyBirdEndsAt: pricingMode === "SCHEDULED" ? date("earlyBirdEndsAt") : undefined,
      maxPerOrder: Number(form.get("maxPerOrder")),
    };
    const response = await fetch("/api/admin/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) { setError(data.error); setBusy(false); return; }
    router.push(`/office/events/${data.id}`);
    router.refresh();
  }

  return <form onSubmit={submit} className={`event-wizard ${busy ? "loading" : ""}`}>
    <section className="panel form wizard-section">
      <div className="wizard-heading"><span>01</span><div><h2>Основные данные</h2><p>Информация, которую увидит покупатель.</p></div></div>
      <div className="field"><label>Название мероприятия</label><input className="input" name="title" required /></div>
      <div className="field"><label>Адрес страницы</label><input className="input" name="slug" pattern="[a-z0-9-]+" required placeholder="event-name-2026" /></div>
      <div className="field"><label>Описание</label><textarea name="description" rows={5} required minLength={20} /></div>
      <div className="field"><label>Афиша JPG, PNG или WebP — до 2 MB</label><input className="input" name="poster" type="file" accept="image/jpeg,image/png,image/webp" /></div>
      <div className="form-grid two"><div className="field"><label>Дата и время начала мероприятия</label><input className="input" name="startsAt" type="datetime-local" required /></div><div className="field"><label>Дата и время открытия дверей</label><input className="input" name="doorsOpenAt" type="datetime-local" required /></div></div>
      <div className="form-grid two"><div className="field"><label>Площадка</label><input className="input" name="venueName" required /></div><div className="field"><label>Город</label><input className="input" name="city" required /></div></div>
      <div className="field"><label>Адрес мероприятия</label><input className="input" name="address" required autoComplete="street-address" placeholder="Улица, дом, дополнительное описание входа" /></div>
    </section>

    <section className="panel form wizard-section">
      <div className="wizard-heading"><span>02</span><div><h2>Как покупатель выбирает билет?</h2><p>Этот выбор определяет весь дальнейший сценарий настройки.</p></div></div>
      <div className="choice-grid">
        <button type="button" className={`choice-card ${admissionMode === "GENERAL_ADMISSION" ? "selected" : ""}`} onClick={() => setAdmissionMode("GENERAL_ADMISSION")}><i>🎟</i><strong>Без схемы зала</strong><small>Покупатель выбирает тип и количество билетов: входной, VIP, ранний тариф и другие.</small><b>Подходит для концертов, клубов и свободной рассадки</b></button>
        <button type="button" className={`choice-card ${admissionMode === "RESERVED_SEATING" ? "selected" : ""}`} onClick={() => setAdmissionMode("RESERVED_SEATING")}><i>▦</i><strong>С выбором мест</strong><small>Вы создаёте карту, размещаете столы, диваны и стулья, затем назначаете им тарифы.</small><b>Подходит для театров, VIP-зон и банкетной рассадки</b></button>
      </div>
      {admissionMode === "RESERVED_SEATING" && <div className="wizard-note">После создания черновика Atlas откроет редактор: сначала дизайн схемы, затем назначение билетов.</div>}
    </section>

    <section className="panel form wizard-section">
      <div className="wizard-heading"><span>03</span><div><h2>Первый тип билета</h2><p>{admissionMode === "RESERVED_SEATING" ? "Позже этот тариф можно назначить столам, диванам, рядам или отдельным местам." : "Дополнительные типы билетов можно добавить после создания мероприятия."}</p></div></div>
      <div className="form-grid three"><div className="field"><label>Название</label><input key={admissionMode} className="input" name="categoryName" defaultValue={admissionMode === "RESERVED_SEATING" ? "VIP Seating" : "General Admission"} required /></div><div className="field"><label>Количество</label><input className="input" name="capacity" type="number" min="1" required /></div><div className="field"><label>Цвет на карте</label><input className="input color-input" name="categoryColor" type="color" defaultValue="#2563EB" /></div></div>
      <div className="field"><label>Что входит в билет</label><textarea name="categoryDescription" rows={2} placeholder="Например: вход в танцевальную зону" /></div>
      <div className="pricing-switch"><button type="button" className={pricingMode === "FIXED" ? "active" : ""} onClick={() => setPricingMode("FIXED")}>Фиксированная цена</button><button type="button" className={pricingMode === "SCHEDULED" ? "active" : ""} onClick={() => setPricingMode("SCHEDULED")}>Цена по расписанию</button></div>
      {pricingMode === "FIXED" ? <div className="field"><label>Цена, ₪</label><input className="input" name="price" type="number" min="0" step="0.01" required /></div> : <div className="form-grid three"><div className="field"><label>Ранняя цена, ₪</label><input className="input" name="earlyBirdPrice" type="number" min="0" step="0.01" required /></div><div className="field"><label>Ранняя цена действует до</label><input className="input" name="earlyBirdEndsAt" type="datetime-local" required /></div><div className="field"><label>Основная цена, ₪</label><input className="input" name="price" type="number" min="0" step="0.01" required /></div></div>}
      <div className="form-grid three"><div className="field"><label>Начало продаж</label><input className="input" name="salesStart" type="datetime-local" required /></div><div className="field"><label>Окончание продаж</label><input className="input" name="salesEnd" type="datetime-local" required /></div><div className="field"><label>Максимум в одном заказе</label><input className="input" name="maxPerOrder" type="number" min="1" max="20" defaultValue="10" required /></div></div>
    </section>

    <section className="panel form wizard-section">
      <div className="wizard-heading"><span>04</span><div><h2>Когда выдавать билет?</h2><p>Эта настройка работает и со схемой, и без неё.</p></div></div>
      <label className="option"><span><strong>Сразу после оплаты</strong><small>Автоматическая продажа и мгновенная выдача QR-билета.</small></span><input type="radio" name="salesMode" value="INSTANT" checked={salesMode === "INSTANT"} onChange={() => setSalesMode("INSTANT")} /></label>
      <label className="option"><span><strong>Только после моего одобрения</strong><small>Покупатель сначала отправляет заявку, затем получает доступ к оплате.</small></span><input type="radio" name="salesMode" value="APPROVAL_REQUIRED" checked={salesMode === "APPROVAL_REQUIRED"} onChange={() => setSalesMode("APPROVAL_REQUIRED")} /></label>
      {salesMode === "APPROVAL_REQUIRED" && <div className="field"><label>Что клиент должен указать</label><textarea name="approvalInstructions" rows={2} defaultValue="Укажите номер клубной карты или кто вас пригласил" /></div>}
    </section>
    {error && <div className="toast">{error}</div>}
    <div className="wizard-submit"><div><strong>Мероприятие будет создано как черновик</strong><small>Вы сможете проверить страницу и настройки перед публикацией.</small></div><button className="btn" disabled={busy}>{busy ? "Создаём..." : admissionMode === "RESERVED_SEATING" ? "Создать и перейти к схеме" : "Создать и настроить билеты"}</button></div>
  </form>;
}
