"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

type Tier = { id: string; label: string; priceMinor: number; startsAt: string; endsAt: string };
export type ManagedCategory = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  pricingMode: "FIXED" | "SCHEDULED";
  capacity: number;
  sold: number;
  hidden: boolean;
  colorHex: string;
  maxPerOrder: number;
  salesStart: string | null;
  salesEnd: string | null;
  priceTiers: Tier[];
  currentPriceMinor: number | null;
  statusLabel: string;
  nextTierPriceMinor?: number;
  nextTierStartsAt?: string;
};

function toLocalInput(iso: string | null) {
  return iso ? iso.slice(0, 16) : "";
}

function CategoryEditForm({ category, onSave }: { category: ManagedCategory; onSave: (body: Record<string, unknown>) => void }) {
  const [pricingMode, setPricingMode] = useState<"FIXED" | "SCHEDULED">(category.pricingMode);
  const earlyTier = category.priceTiers.find((tier) => tier.label === "Early bird");
  const regularTier = category.priceTiers.find((tier) => tier.label === "Regular");

  return (
    <form
      className="form"
      style={{ padding: "18px 4px" }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const iso = (name: string) => new Date(String(form.get(name))).toISOString();
        onSave({
          name: form.get("name"),
          description: form.get("description"),
          colorHex: form.get("colorHex"),
          priceMinor: Math.round(Number(form.get("price")) * 100),
          capacity: Number(form.get("capacity")),
          pricingMode,
          salesStart: iso("salesStart"),
          salesEnd: iso("salesEnd"),
          earlyBirdPriceMinor: pricingMode === "SCHEDULED" ? Math.round(Number(form.get("earlyBirdPrice")) * 100) : undefined,
          earlyBirdEndsAt: pricingMode === "SCHEDULED" ? iso("earlyBirdEndsAt") : undefined,
          maxPerOrder: Number(form.get("maxPerOrder")),
        });
      }}
    >
      <div className="form-grid three">
        <input className="input" name="name" defaultValue={category.name} placeholder="Название" required />
        <input className="input" name="capacity" type="number" min={category.sold} defaultValue={category.capacity} placeholder="Количество" required />
        <label className="field">
          <span>Цвет на карте</span>
          <input className="input color-input" name="colorHex" type="color" defaultValue={category.colorHex} />
        </label>
      </div>
      <textarea name="description" rows={2} defaultValue={category.description ?? ""} placeholder="Что входит в билет" />
      <div className="pricing-switch">
        <button type="button" className={pricingMode === "FIXED" ? "active" : ""} onClick={() => setPricingMode("FIXED")}>Фиксированная цена</button>
        <button type="button" className={pricingMode === "SCHEDULED" ? "active" : ""} onClick={() => setPricingMode("SCHEDULED")}>Цена по расписанию</button>
      </div>
      {pricingMode === "SCHEDULED" && (
        <div className="form-grid two">
          <div className="field">
            <label>Ранняя цена, ₪</label>
            <input className="input" name="earlyBirdPrice" type="number" min="0" step="0.01" defaultValue={earlyTier ? earlyTier.priceMinor / 100 : undefined} required />
          </div>
          <div className="field">
            <label>Действует до</label>
            <input className="input" name="earlyBirdEndsAt" type="datetime-local" defaultValue={toLocalInput(earlyTier?.endsAt ?? null)} required />
          </div>
        </div>
      )}
      <div className="form-grid two">
        <div className="field">
          <label>{pricingMode === "SCHEDULED" ? "Основная цена, ₪" : "Цена, ₪"}</label>
          <input className="input" name="price" type="number" min="0" step="0.01" defaultValue={(regularTier ? regularTier.priceMinor : category.priceMinor) / 100} required />
        </div>
        <div className="field">
          <label>Максимум в заказе</label>
          <input className="input" name="maxPerOrder" type="number" min="1" max="20" defaultValue={category.maxPerOrder} required />
        </div>
      </div>
      <div className="form-grid two">
        <div className="field">
          <label>Начало продаж</label>
          <input className="input" name="salesStart" type="datetime-local" defaultValue={toLocalInput(category.salesStart)} required />
        </div>
        <div className="field">
          <label>Окончание продаж</label>
          <input className="input" name="salesEnd" type="datetime-local" defaultValue={toLocalInput(category.salesEnd)} required />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Уже продано билетов: {category.sold}. Количество нельзя опустить ниже этого числа.</p>
      <button className="btn">Сохранить изменения</button>
    </form>
  );
}

export function CategoryManager({ eventId, categories }: { eventId: string; categories: ManagedCategory[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function send(body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch(`/api/admin/events/${eventId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    setMessage(response.ok ? "Сохранено" : data.error);
    if (response.ok) {
      setEditingId(null);
      router.refresh();
    }
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Категория</th>
            <th>Цена сейчас</th>
            <th>Продано</th>
            <th>Остаток</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {categories.map((item) => (
            <Fragment key={item.id}>
              <tr style={item.hidden ? { opacity: 0.55 } : undefined}>
                <td>
                  <strong>{item.name}</strong>
                  {item.hidden && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Скрыта от покупателей</div>}
                </td>
                <td>
                  {item.currentPriceMinor !== null ? money(item.currentPriceMinor) : <span className="muted">{item.statusLabel}</span>}
                  {item.pricingMode === "SCHEDULED" && <div className="pill" style={{ marginTop: 6 }}>по расписанию</div>}
                  {item.nextTierPriceMinor !== undefined && item.nextTierStartsAt && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {money(item.nextTierPriceMinor)} c {new Date(item.nextTierStartsAt).toLocaleString("ru-RU")}
                    </div>
                  )}
                </td>
                <td>{item.sold}</td>
                <td>{item.capacity - item.sold}</td>
                <td>
                  <div className="row">
                    <button type="button" className="btn secondary" onClick={() => setEditingId(editingId === item.id ? null : item.id)}>
                      {editingId === item.id ? "Отмена" : "Редактировать"}
                    </button>
                    <button type="button" className="btn secondary" onClick={() => void send({ action: "category-visibility", categoryId: item.id, hidden: !item.hidden })}>
                      {item.hidden ? "Показать" : "Скрыть"}
                    </button>
                  </div>
                </td>
              </tr>
              {editingId === item.id && (
                <tr>
                  <td colSpan={5}>
                    <CategoryEditForm category={item} onSave={(body) => void send({ action: "category-update", categoryId: item.id, ...body })} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
