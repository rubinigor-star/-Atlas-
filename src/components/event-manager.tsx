"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

const copy = {
  ru: { saved: "Сохранено", key: "Ключевая настройка", sell: "Как продавать билеты", instant: "Автоматическая продажа", instantHelp: "После тестовой оплаты клиент сразу получает билет и QR-код.", approval: "Только после моего одобрения", approvalHelp: "Клиент отправляет заявку. Оплата и билет становятся доступны после проверки.", question: "Что клиент должен указать в заявке", saveMode: "Сохранить режим продажи", basics: "Основные данные", title: "Название", description: "Описание", date: "Дата и время", save: "Сохранить", unpublish: "Снять с публикации", publish: "Опубликовать", addCategory: "Добавить категорию", name: "Название", price: "Цена ₪", amount: "Количество", add: "Добавить", addVip: "Быстро добавить VIP-стол", zone: "Зона", table: "Стол V9", seats: "Мест", tablePrice: "Цена стола ₪", addTable: "Добавить стол" },
  he: { saved: "נשמר", key: "הגדרה מרכזית", sell: "איך למכור כרטיסים", instant: "מכירה אוטומטית", instantHelp: "לאחר תשלום ניסיון הלקוח מקבל מיד כרטיס וקוד QR.", approval: "רק לאחר האישור שלי", approvalHelp: "הלקוח שולח בקשה. התשלום והכרטיס זמינים לאחר הבדיקה.", question: "מה הלקוח צריך לציין בבקשה", saveMode: "שמירת מצב המכירה", basics: "פרטים בסיסיים", title: "שם", description: "תיאור", date: "תאריך ושעה", save: "שמירה", unpublish: "הסרה מפרסום", publish: "פרסום", addCategory: "הוספת קטגוריה", name: "שם", price: "מחיר ₪", amount: "כמות", add: "הוספה", addVip: "הוספה מהירה של שולחן VIP", zone: "אזור", table: "שולחן V9", seats: "מקומות", tablePrice: "מחיר שולחן ₪", addTable: "הוספת שולחן" },
};

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
  const { locale } = useLocale();
  const text = copy[locale];
  const [message, setMessage] = useState("");

  async function send(body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setMessage(response.ok ? text.saved : data.error);
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
        <span className="eyebrow">{text.key}</span>
        <h2>{text.sell}</h2>
        <label className="option">
          <span>
            <strong>{text.instant}</strong>
            <small>{text.instantHelp}</small>
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
            <strong>{text.approval}</strong>
            <small>{text.approvalHelp}</small>
          </span>
          <input
            type="radio"
            name="salesMode"
            value="APPROVAL_REQUIRED"
            defaultChecked={event.salesMode === "APPROVAL_REQUIRED"}
          />
        </label>
        <div className="field">
          <label>{text.question}</label>
          <textarea
            name="approvalInstructions"
            rows={3}
            defaultValue={event.approvalInstructions || "Укажите номер клубной карты или кто вас пригласил"}
          />
        </div>
        <button className="btn">{text.saveMode}</button>
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
        <h2>{text.basics}</h2>
        <div className="field"><label>{text.title}</label><input className="input" name="title" defaultValue={event.title} required /></div>
        <div className="field"><label>{text.description}</label><textarea name="description" rows={5} defaultValue={event.description} required /></div>
        <div className="field"><label>{text.date}</label><input className="input" name="startsAt" type="datetime-local" defaultValue={event.startsAt.slice(0, 16)} required /></div>
        <div className="row">
          <button className="btn">{text.save}</button>
          <button type="button" className="btn secondary" onClick={() => void send({ action: "status", status: event.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })}>
            {event.status === "PUBLISHED" ? text.unpublish : text.publish}
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
        <h2>{text.addCategory}</h2>
        <div className="row"><input className="input" name="name" placeholder={text.name} required /><input className="input" name="price" type="number" min="1" placeholder={text.price} required /><input className="input" name="capacity" type="number" min="1" placeholder={text.amount} required /></div>
        <button className="btn">{text.add}</button>
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
        <h2>{text.addVip}</h2>
        <div className="row"><input className="input" name="zoneName" placeholder={text.zone} required /><input className="input" name="label" placeholder={text.table} required /><input className="input" name="seats" type="number" min="1" placeholder={text.seats} required /><input className="input" name="price" type="number" min="1" placeholder={text.tablePrice} required /></div>
        <button className="btn">{text.addTable}</button>
      </form>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
