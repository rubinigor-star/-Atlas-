"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingMarketingIntensity, PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";

const intensityCopy: Record<PricingMarketingIntensity, { title: string; help: string }> = {
  CALM: { title: "Спокойный", help: "Показываем только этап цены и, при наличии, таймер." },
  STANDARD: { title: "Стандартный", help: "Таймер и следующая цена без раскрытия количества продаж." },
  ACTIVE: { title: "Активный", help: "Добавляем ощущение ограниченности текущего этапа, но не показываем общие продажи." },
  MAXIMUM: { title: "Максимальный", help: "Можно дополнительно показать остаток и социальное доказательство." },
};

type CategoryStrategy = {
  id: string;
  name: string;
  pricingMode: "FIXED" | "SCHEDULED";
  strategy: PricingMarketingStrategy;
};

export function PricingStrategyManager({ eventId, categories }: { eventId: string; categories: CategoryStrategy[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<Record<string, PricingMarketingStrategy>>(
    Object.fromEntries(categories.map((category) => [category.id, category.strategy])),
  );

  function patch(id: string, value: Partial<PricingMarketingStrategy>) {
    setValues((current) => ({ ...current, [id]: { ...current[id], ...value } }));
  }

  async function save(categoryId: string) {
    setBusyId(categoryId);
    setMessage("");
    const response = await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pricingStrategy", categoryId, ...values[categoryId] }),
    });
    const data = await response.json();
    setBusyId("");
    setMessage(response.ok ? "✓ Стратегия сохранена" : data.error || "Не удалось сохранить стратегию");
    if (response.ok) router.refresh();
    window.setTimeout(() => setMessage(""), 2800);
  }

  return <section className="panel form">
    <span className="eyebrow">Маркетинг цены</span>
    <h2>Стратегия продаж</h2>
    <p className="muted">Создавайте срочность без обязательного раскрытия слабых продаж. По умолчанию клиент видит этап, таймер и следующую цену, но не видит, сколько билетов уже продано.</p>
    {categories.length === 0 ? <div className="toast">Сначала создайте хотя бы одну категорию билетов.</div> : categories.map((category) => {
      const strategy = values[category.id];
      return <details className="panel" key={category.id} open={categories.length === 1}>
        <summary><strong>{category.name}</strong> · {intensityCopy[strategy.intensity].title}</summary>
        <div className="form" style={{ marginTop: 16 }}>
          <div className="field"><label>Интенсивность маркетинга</label><select value={strategy.intensity} onChange={(event) => {
            const intensity = event.target.value as PricingMarketingIntensity;
            patch(category.id, {
              intensity,
              showCountdown: true,
              showNextPrice: intensity !== "CALM",
              showStageRemaining: intensity === "ACTIVE" || intensity === "MAXIMUM",
              showTotalRemaining: intensity === "MAXIMUM" ? strategy.showTotalRemaining : false,
              showSoldCount: intensity === "MAXIMUM" ? strategy.showSoldCount : false,
            });
          }}>{Object.entries(intensityCopy).map(([key, item]) => <option key={key} value={key}>{item.title}</option>)}</select><small className="muted">{intensityCopy[strategy.intensity].help}</small></div>
          <label className="option"><span><strong>Показывать обратный отсчёт</strong><small>Например: «Цена повысится через 2 дня».</small></span><input type="checkbox" checked={strategy.showCountdown} onChange={(event) => patch(category.id, { showCountdown: event.target.checked })} /></label>
          <label className="option"><span><strong>Показывать следующую цену</strong><small>Клиент понимает финансовую выгоду покупки сейчас.</small></span><input type="checkbox" checked={strategy.showNextPrice} onChange={(event) => patch(category.id, { showNextPrice: event.target.checked })} /></label>
          <label className="option"><span><strong>Показывать ограниченность текущего этапа</strong><small>Формулировка без общей статистики: «Текущий этап заканчивается скоро».</small></span><input type="checkbox" checked={strategy.showStageRemaining} onChange={(event) => patch(category.id, { showStageRemaining: event.target.checked })} /></label>
          <label className="option"><span><strong>Показывать общий остаток билетов</strong><small>Включайте только когда эта цифра помогает продажам.</small></span><input type="checkbox" checked={strategy.showTotalRemaining} onChange={(event) => patch(category.id, { showTotalRemaining: event.target.checked })} /></label>
          <label className="option"><span><strong>Показывать количество проданных билетов</strong><small>По умолчанию выключено. Используйте только для сильного социального доказательства.</small></span><input type="checkbox" checked={strategy.showSoldCount} onChange={(event) => patch(category.id, { showSoldCount: event.target.checked })} /></label>
          {category.pricingMode === "FIXED" && <p className="muted">У этой категории фиксированная цена, поэтому таймер и следующая цена появятся только после настройки этапов цены.</p>}
          <button type="button" className="btn" disabled={busyId === category.id} onClick={() => void save(category.id)}>{busyId === category.id ? "Сохраняем..." : "Сохранить стратегию"}</button>
        </div>
      </details>;
    })}
    {message && <div className="toast save-feedback" role="status">{message}</div>}
  </section>;
}
