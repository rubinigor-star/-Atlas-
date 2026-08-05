"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  refundableMinor: number;
  enabled: boolean;
  disabledReason?: string;
  requestId?: string;
  suggestedAmountMinor?: number;
  suggestedReason?: string;
};

export function OrderRefundManager({ orderId, refundableMinor, enabled, disabledReason, requestId, suggestedAmountMinor, suggestedReason }: Props) {
  const router = useRouter();
  const initialAmount = Math.min(suggestedAmountMinor || refundableMinor, refundableMinor);
  const [amount, setAmount] = useState((initialAmount / 100).toFixed(2));
  const [reason, setReason] = useState(suggestedReason || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refund() {
    if (!enabled) {
      setMessage(disabledReason || "Возврат недоступен");
      return;
    }

    const amountMinor = Math.round(Number(amount) * 100);
    if (!amountMinor || amountMinor < 1) {
      setMessage("Укажите сумму возврата");
      return;
    }
    if (amountMinor > refundableMinor) {
      setMessage(`Доступно к возврату не более ${(refundableMinor / 100).toFixed(2)} ₪`);
      return;
    }
    if (reason.trim().length < 3) {
      setMessage("Укажите причину возврата");
      return;
    }

    const full = amountMinor === refundableMinor;
    const confirmation = full
      ? `Полностью вернуть ${(amountMinor / 100).toFixed(2)} ₪? После подтверждения HYP заказ и все билеты будут отменены.`
      : `Вернуть ${(amountMinor / 100).toFixed(2)} ₪? Билеты останутся действительными, а заказ получит статус частичного возврата.`;
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountMinor,
          reason: reason.trim(),
          requestId: requestId || undefined,
          idempotencyKey: `organizer:${orderId}:${amountMinor}:${requestId || "direct"}`,
        }),
      });
      const data = await response.json().catch(() => ({ error: "Некорректный ответ сервера" }));
      if (!response.ok) throw new Error(data.error || "Возврат не выполнен");
      setMessage(`Возврат ${(data.amountMinor / 100).toFixed(2)} ₪ подтверждён HYP${data.refundTranId ? `, транзакция ${data.refundTranId}` : ""}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка возврата");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel form">
    <span className="eyebrow">Действие организатора</span>
    <h2>Выполнить возврат</h2>
    <p className="muted">Организатор может вернуть деньги сам, даже без заявки клиента. Деньги отправляются через HYP на исходную карту. Статусы заказа и билетов меняются только после подтверждения HYP.</p>

    {!enabled && <div className="toast" style={{ background: "#fff8e8" }}><strong>Возврат пока недоступен</strong><p style={{ marginBottom: 0 }}>{disabledReason || "Платёж не готов к возврату"}</p></div>}
    {requestId && <div className="toast"><strong>Есть запрос клиента</strong><p style={{ marginBottom: 0 }}>Сумма и причина заполнены из заявки. Ты можешь изменить их перед подтверждением.</p></div>}

    <div className="form-grid two">
      <div className="field">
        <label>Сумма возврата, ₪</label>
        <input className="input" type="number" min="0.01" max={(refundableMinor / 100).toFixed(2)} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} disabled={!enabled || busy}/>
        <small className="muted">Доступно: {(refundableMinor / 100).toFixed(2)} ₪</small>
      </div>
      <div className="field">
        <label>Причина</label>
        <input className="input" value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: возврат по просьбе клиента" disabled={!enabled || busy}/>
      </div>
    </div>

    <button type="button" className="btn" onClick={() => void refund()} disabled={!enabled || busy}>
      {busy ? "Отправляем запрос в HYP…" : "Подтвердить возврат через HYP"}
    </button>
    {message && <div className="toast">{message}</div>}
  </section>;
}
