"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

type CheckoutFormProps = {
  eventId: string;
  categoryId: string;
  quantity: number;
  tableId?: string;
  total: number;
  title: string;
  label: string;
  salesMode: "INSTANT" | "APPROVAL_REQUIRED";
  approvalInstructions?: string | null;
};

export function CheckoutForm(props: CheckoutFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState("");
  const approvalRequired = props.salesMode === "APPROVAL_REQUIRED";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: props.eventId,
        categoryId: props.categoryId,
        quantity: props.quantity,
        tableId: props.tableId || null,
        promoCode: promo || undefined,
        eligibilityAnswer: form.get("eligibilityAnswer") || undefined,
        customer: {
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Не удалось отправить данные");
      setBusy(false);
      return;
    }
    router.push(`/orders/${data.orderId}`);
  }

  return (
    <form onSubmit={submit} className={`checkout ${busy ? "loading" : ""}`}>
      <section>
        <span className="eyebrow">{approvalRequired ? "Заявка на билет" : "Checkout"}</span>
        <h1>{approvalRequired ? "Данные для рассмотрения" : "Контактные данные"}</h1>
        <div className="panel form">
          <div className="field">
            <label>Имя и фамилия</label>
            <input className="input" name="name" required minLength={2} autoComplete="name" />
          </div>
          <div className="field">
            <label>Телефон</label>
            <input className="input" name="phone" required autoComplete="tel" placeholder="+972..." />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" name="email" required type="email" autoComplete="email" />
          </div>
          {approvalRequired && (
            <div className="field">
              <label>{props.approvalInstructions || "Дополнительная информация для организатора"}</label>
              <textarea
                name="eligibilityAnswer"
                rows={4}
                required
                placeholder="Например, номер клубной карты или кто вас пригласил"
              />
            </div>
          )}
          {!approvalRequired && (
            <div className="field">
              <label>Промокод</label>
              <input
                className="input"
                value={promo}
                onChange={(event) => setPromo(event.target.value.toUpperCase())}
                placeholder="Например, ATLAS10"
              />
            </div>
          )}
          <div className="panel" style={{ background: approvalRequired ? "#fff8e8" : "#f8fafc" }}>
            <strong>{approvalRequired ? "Сначала проверка организатором" : "Тестовая оплата"}</strong>
            <p className="muted">
              {approvalRequired
                ? "Сейчас деньги не списываются. После одобрения вы получите возможность оплатить заказ и получить билет."
                : "Данные карты не требуются. Будет создан демонстрационный оплаченный заказ."}
            </p>
          </div>
          {error && <div className="toast">{error}</div>}
          <button className="btn" disabled={busy}>
            {busy
              ? "Отправляем..."
              : approvalRequired
                ? "Отправить заявку организатору"
                : "Подтвердить тестовый заказ"}
          </button>
        </div>
      </section>
      <aside className="panel summary">
        <span className="pill">{approvalRequired ? "Запрашиваемый билет" : "Ваш заказ"}</span>
        <h2>{props.title}</h2>
        <p>{props.label}</p>
        <div className="row between">
          <span className="muted">Количество</span>
          <strong>{props.quantity}</strong>
        </div>
        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "18px 0" }} />
        <div className="row between">
          <strong>{approvalRequired ? "К оплате после одобрения" : "Итого"}</strong>
          <strong style={{ fontSize: 25 }}>{money(props.total)}</strong>
        </div>
      </aside>
    </form>
  );
}
