"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";

const copy = {
  ru: {
    title: "Удаление билетов",
    help: "Удаляйте только неиспользованные категории. Если билет уже участвовал в заказах, Atlas сохранит его историю и предложит скрыть его с продажи.",
    delete: "Удалить билет",
    deleting: "Удаляем...",
    sold: "Есть продажи - удаление недоступно",
    confirm: "Удалить этот билет без возможности восстановления?",
    error: "Не удалось удалить билет",
  },
  he: {
    title: "מחיקת כרטיסים",
    help: "ניתן למחוק רק קטגוריות שלא נעשה בהן שימוש. אם הכרטיס כבר הופיע בהזמנות, Atlas ישמור את היסטוריית המכירות וניתן יהיה להסתיר אותו מהמכירה.",
    delete: "מחיקת כרטיס",
    deleting: "מוחק...",
    sold: "קיימות מכירות - לא ניתן למחוק",
    confirm: "למחוק את הכרטיס ללא אפשרות שחזור?",
    error: "לא ניתן למחוק את הכרטיס",
  },
  en: {
    title: "Delete tickets",
    help: "Only unused categories can be deleted. If a ticket has already appeared in orders, Atlas keeps the sales history and you can hide it from sale instead.",
    delete: "Delete ticket",
    deleting: "Deleting...",
    sold: "Has sales - cannot delete",
    confirm: "Delete this ticket permanently?",
    error: "Could not delete ticket",
  },
} as const;

type Category = { id: string; name: string; sold: number; hidden: boolean };

export function CategoryDeleteManager({ eventId, categories }: { eventId: string; categories: Category[] }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(category: Category) {
    if (category.sold > 0) return;
    if (!window.confirm(`${text.confirm}\n\n${category.name}`)) return;
    setError("");
    setBusyId(category.id);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/categories/${encodeURIComponent(category.id)}`,
        { method: "DELETE" },
      );
      const raw = await response.text();
      let data: { error?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!response.ok) {
        setError(data.error || text.error);
        return;
      }
      window.location.reload();
    } catch {
      setError(text.error);
    } finally {
      setBusyId(null);
    }
  }

  if (!categories.length) return null;

  return (
    <section className="panel stack">
      <div>
        <span className="eyebrow">Ticket cleanup</span>
        <h2>{text.title}</h2>
        <p className="muted">{text.help}</p>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {categories.map((category) => (
          <div key={category.id} className="row between" style={{ gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>{category.name}</strong>
              {category.sold > 0 && <div className="muted" style={{ fontSize: 12 }}>{text.sold}</div>}
            </div>
            <button
              type="button"
              className="btn secondary"
              disabled={category.sold > 0 || busyId !== null}
              onClick={() => void remove(category)}
              style={category.sold === 0 ? { borderColor: "#dc2626", color: "#dc2626" } : undefined}
            >
              {busyId === category.id ? text.deleting : text.delete}
            </button>
          </div>
        ))}
      </div>
      {error && <div className="toast" role="alert">{error}</div>}
    </section>
  );
}
