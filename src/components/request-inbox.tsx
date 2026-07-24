"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Search, UserRoundCheck, X } from "lucide-react";
import { money } from "@/lib/format";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

type RequestItem = { name: string; quantity: number };
export type RequestRecord = {
  id: string;
  publicId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  birthDate: string | null;
  city: string | null;
  facebook: string | null;
  instagram: string | null;
  guestStatus: string | null;
  previousOrders: number;
  previousVisits: number;
  answer: string | null;
  status: string;
  eventTitle: string;
  eventDate: string;
  createdAt: string;
  totalMinor: number;
  items: RequestItem[];
};

type QueueFilter = "all" | "PENDING_APPROVAL" | "AWAITING_PAYMENT" | "PAID" | "REJECTED" | "CANCELLED";

const statusMeta: Record<string, { label: string; background: string; color: string }> = {
  PENDING_APPROVAL: { label: "Ожидает решения", background: "#fff4cc", color: "#8a5a00" },
  AWAITING_PAYMENT: { label: "Одобрена · ждёт оплату", background: "#dbeafe", color: "#1d4ed8" },
  PAID: { label: "Оплачена · билет выдан", background: "#dcfce7", color: "#166534" },
  REJECTED: { label: "Отклонена", background: "#fee2e2", color: "#b91c1c" },
  CANCELLED: { label: "Отменена", background: "#e5e7eb", color: "#4b5563" },
};

function age(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const now = new Date();
  let result = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) result--;
  return result;
}

function whatsapp(phone: string, name: string, eventTitle: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Здравствуйте, ${name}. Пишем вам по поводу заявки на мероприятие «${eventTitle}».`)}`;
}

export function RequestInbox({ initialRequests, compact = false }: { initialRequests: RequestRecord[]; compact?: boolean }) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<QueueFilter>("PENDING_APPROVAL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const counts = Object.fromEntries(
    ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAID", "REJECTED", "CANCELLED"].map((status) => [
      status,
      requests.filter((item) => item.status === status).length,
    ]),
  );

  const visible = useMemo(
    () =>
      requests
        .filter(
          (item) =>
            (filter === "all" || item.status === filter) &&
            `${item.customerName} ${item.customerPhone} ${item.eventTitle} ${item.city || ""} ${item.status}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .slice(0, compact ? 5 : 999),
    [requests, filter, query, compact],
  );

  async function decide(item: RequestRecord, action: "approve" | "reject") {
    setBusy(item.id);
    setError("");
    const response = await fetch(`/api/admin/orders/${item.publicId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        note: action === "approve" ? "Одобрено в Atlas Office" : "Заявка отклонена организатором",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Не удалось обработать заявку");
      setBusy("");
      return;
    }
    setRequests((current) => current.map((record) => (record.id === item.id ? { ...record, status: data.status } : record)));
    setBusy("");
  }

  async function changeStatus(item: RequestRecord, value: string) {
    if (value === "approve") await decide(item, "approve");
    if (value === "reject") await decide(item, "reject");
  }

  const filters: Array<[QueueFilter, string]> = [
    ["PENDING_APPROVAL", "Ожидают"],
    ["AWAITING_PAYMENT", "Одобрены"],
    ["PAID", "Оплачены"],
    ["REJECTED", "Отклонены"],
    ["CANCELLED", "Отменены"],
    ["all", "Все"],
  ];

  return (
    <>
      <div className="request-kpis">
        {filters.map(([key, label]) => (
          <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
            <Clock3 />
            <span>{label}</span>
            <strong>{key === "all" ? requests.length : counts[key] || 0}</strong>
          </button>
        ))}
      </div>

      <div className="request-toolbar">
        <label>
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон, город, мероприятие или статус" />
        </label>
      </div>

      {error && <div className="toast">{error}</div>}

      <div className="request-grid">
        {visible.map((item) => {
          const meta = statusMeta[item.status] || { label: item.status, background: "#e5e7eb", color: "#111827" };
          return (
            <article className="request-card" key={item.id}>
              <header>
                <div className="request-avatar">{item.customerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                <div>
                  <strong>{item.customerName}</strong>
                  <a href={`tel:${item.customerPhone}`}>{item.customerPhone}</a>
                </div>
                <span className="request-status" style={{ background: meta.background, color: meta.color }}>{meta.label}</span>
              </header>

              <div className="request-event">
                <small>{item.eventTitle}</small>
                <strong>{item.items.map((ticket) => `${ticket.name} × ${ticket.quantity}`).join(", ")}</strong>
                <span>{money(item.totalMinor)}</span>
              </div>

              {!compact && (
                <div className="panel" style={{ background: "#f8fafc" }}>
                  <strong>{item.guestStatus || "REGULAR"}</strong>
                  <p className="muted">{age(item.birthDate) !== null ? `${age(item.birthDate)} лет · ` : ""}{item.city || "Город не указан"}</p>
                  <p className="muted">Заказов ранее: {item.previousOrders} · посещений: {item.previousVisits}</p>
                  <p className="muted">{item.instagram || "Instagram не указан"} · {item.facebook || "Facebook не указан"}</p>
                </div>
              )}

              {item.answer && <blockquote><small>Ответ клиента</small>{item.answer}</blockquote>}

              <footer>
                <small>Получена {new Date(item.createdAt).toLocaleString("ru-RU")}</small>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <a
                    className="btn secondary"
                    style={{ color: "#128C7E" }}
                    target="_blank"
                    rel="noreferrer"
                    href={whatsapp(item.customerPhone, item.customerName, item.eventTitle)}
                    aria-label={`Открыть WhatsApp с ${item.customerName}`}
                  >
                    <WhatsAppIcon size={18} /> WhatsApp
                  </a>
                  <Link className="btn secondary" href={`/office/orders/${item.publicId}?returnTo=${encodeURIComponent("/office/requests")}`}>
                    Подробнее
                  </Link>
                </div>
              </footer>

              {item.status === "PENDING_APPROVAL" && (
                <div className="request-actions">
                  <select
                    aria-label={`Изменить статус заявки ${item.customerName}`}
                    defaultValue=""
                    disabled={busy === item.id}
                    onChange={(event) => {
                      const value = event.target.value;
                      event.target.value = "";
                      void changeStatus(item, value);
                    }}
                  >
                    <option value="" disabled>{busy === item.id ? "Обрабатываем…" : "Изменить статус"}</option>
                    <option value="approve">Одобрить и завершить оплату</option>
                    <option value="reject">Отклонить заявку</option>
                  </select>
                  <button disabled={busy === item.id} className="approve" onClick={() => void decide(item, "approve")}>
                    <Check size={18} />{busy === item.id ? "Обрабатываем…" : "Одобрить"}
                  </button>
                  <button disabled={busy === item.id} className="reject" onClick={() => void decide(item, "reject")}>
                    <X size={18} />Отклонить
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {visible.length === 0 && (
          <div className="office-empty">
            <UserRoundCheck size={38} />
            <h3>В этой категории заявок нет</h3>
            <p>Смените фильтр или поисковый запрос.</p>
          </div>
        )}
      </div>

      {compact && <Link className="btn secondary" href="/office/requests">Открыть всю очередь</Link>}
    </>
  );
}
