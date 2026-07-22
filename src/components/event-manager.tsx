"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ManagedEvent = {
  id: string;
  title: string;
  description: string;
  status: string;
  startsAt: string;
  salesMode: "INSTANT" | "APPROVAL_REQUIRED";
  approvalInstructions: string | null;
};

export function EventManager({ event }: { event: ManagedEvent }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function send(body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setMessage(response.ok ? "Сохранено" : data.error);
    if (response.ok) router.refresh();
  }

  return (
    <div className="form">
      <form
        className="panel form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const form = new FormData(submitEvent.currentTarget);
          void send({
            action: "sales",
            salesMode: form.get("salesMode"),
            approvalInstructions: form.get("approvalInstructions"),
          });
        }}
      >
        <span className="eyebrow">Ключевая настройка</span>
        <h2>Как продавать билеты</h2>
        <label className="option">
          <span>
            <strong>Автоматическая продажа</strong>
            <small>После тестовой оплаты клиент сразу получает билет и QR-код.</small>
          </span>
          <input
            type="radio"
            name="salesMode"
            value="INSTANT"
            defaultChecked={event.salesMode === "INSTANT"}
          />
        </label>
        <label className="option">
          <span>
            <strong>Только после моего одобрения</strong>
            <small>Клиент отправляет заявку. Оплата и билет становятся доступны после проверки.</small>
          </span>
          <input
            type="radio"
            name="salesMode"
            value="APPROVAL_REQUIRED"
            defaultChecked={event.salesMode === "APPROVAL_REQUIRED"}
          />
        </label>
        <div className="field">
          <label>Что клиент должен указать в заявке</label>
          <textarea
            name="approvalInstructions"
            rows={3}
            defaultValue={event.approvalInstructions || "Укажите номер клубной карты или кто вас пригласил"}
          />
        </div>
        <button className="btn">Сохранить режим продажи</button>
      </form>

      <form
        className="panel form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const form = new FormData(submitEvent.currentTarget);
          void send({
            action: "update",
            title: form.get("title"),
            description: form.get("description"),
            startsAt: new Date(String(form.get("startsAt"))).toISOString(),
          });
        }}
      >
        <h2>Основные данные</h2>
        <div className="field"><label>Название</label><input className="input" name="title" defaultValue={event.title} required /></div>
        <div className="field"><label>Описание</label><textarea name="description" rows={5} defaultValue={event.description} required /></div>
        <div className="field"><label>Дата и время</label><input className="input" name="startsAt" type="datetime-local" defaultValue={event.startsAt.slice(0, 16)} required /></div>
        <div className="row">
          <button className="btn">Сохранить</button>
          <button type="button" className="btn secondary" onClick={() => void send({ action: "status", status: event.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })}>
            {event.status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать"}
          </button>
        </div>
      </form>

      <form
        className="panel form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const form = new FormData(submitEvent.currentTarget);
          void send({ action: "category", name: form.get("name"), priceMinor: Math.round(Number(form.get("price")) * 100), capacity: Number(form.get("capacity")) });
          submitEvent.currentTarget.reset();
        }}
      >
        <h2>Добавить категорию</h2>
        <div className="row"><input className="input" name="name" placeholder="Название" required /><input className="input" name="price" type="number" min="1" placeholder="Цена ₪" required /><input className="input" name="capacity" type="number" min="1" placeholder="Количество" required /></div>
        <button className="btn">Добавить</button>
      </form>

      <form
        className="panel form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const form = new FormData(submitEvent.currentTarget);
          void send({ action: "table", zoneName: form.get("zoneName"), label: form.get("label"), seats: Number(form.get("seats")), priceMinor: Math.round(Number(form.get("price")) * 100) });
          submitEvent.currentTarget.reset();
        }}
      >
        <h2>Добавить VIP-стол</h2>
        <div className="row"><input className="input" name="zoneName" placeholder="Зона" required /><input className="input" name="label" placeholder="Стол V9" required /><input className="input" name="seats" type="number" min="1" placeholder="Мест" required /><input className="input" name="price" type="number" min="1" placeholder="Цена стола ₪" required /></div>
        <button className="btn">Добавить стол</button>
      </form>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
