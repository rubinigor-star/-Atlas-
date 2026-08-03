"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderRefundManager({
  orderId,
  totalMinor,
  alreadyRefunded,
}: {
  orderId: string;
  totalMinor: number;
  alreadyRefunded: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const amountIls = Math.round(totalMinor / 100);

  async function refund() {
    if (reason.trim().length < 3) {
      setMessage("Укажите причину возврата");
      return;
    }

    if (!window.confirm(`Полностью вернуть ${amountIls} ₪? Все билеты заказа будут аннулированы, а места снова поступят в продажу.`)) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await response.json().catch(() => ({ error: "Некорректный ответ сервера" }));
      if (!response.ok) throw new Error(data.error || "Возврат не выполнен");
      setMessage(`✓ Полный возврат ${Math.round(data.amountMinor / 100)} ₪ подтверждён HYP`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка возврата");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form">
      <span className="eyebrow">Финансы</span>
      <h2>Возврат средств</h2>
      <p className="muted">
        Полный возврат {amountIls} ₪ будет отправлен через HYP на исходный способ оплаты. После подтверждения билеты аннулируются, а места освобождаются.
      </p>
      {alreadyRefunded ? (
        <div className="toast">По этому заказу возврат уже зарегистрирован.</div>
      ) : (
        <>
          <div className="field">
            <label>Причина возврата</label>
            <input
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Например: мероприятие отменено"
            />
          </div>
          <button type="button" className="btn" onClick={() => void refund()} disabled={busy}>
            {busy ? "Отправляем возврат…" : `Вернуть ${amountIls} ₪ через HYP`}
          </button>
        </>
      )}
      {message && <div className="toast">{message}</div>}
    </section>
  );
}
