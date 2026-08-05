"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  refundableMinor: number;
  enabled: boolean;
  disabledReason: string;
  requestId?: string;
  suggestedAmountMinor?: number;
  suggestedReason?: string;
};

export function OrderRefundManager({ orderId, refundableMinor, enabled, disabledReason, requestId, suggestedAmountMinor, suggestedReason }: Props) {
  const router = useRouter();
  const recoveryStarted = useRef(false);
  const initialMinor = suggestedAmountMinor && suggestedAmountMinor > 0 ? suggestedAmountMinor : refundableMinor;
  const [amount, setAmount] = useState((initialMinor / 100).toFixed(2));
  const [reason, setReason] = useState(suggestedReason || "");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (enabled || recoveryStarted.current || disabledReason !== "Платёжная транзакция HYP не найдена") return;
    recoveryStarted.current = true;
    setRecovering(true);
    setMessage("Проверяем старую запись HYP…");
    void fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/recover-payment`, { method: "POST" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({ error: "Некорректный ответ сервера" }));
        if (!response.ok) throw new Error(data.error || "Транзакцию восстановить не удалось");
        setMessage(data.recovered ? "✓ Транзакция HYP восстановлена. Обновляем заказ…" : "Транзакция уже доступна.");
        router.refresh();
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Транзакцию восстановить не удалось"))
      .finally(() => setRecovering(false));
  }, [disabledReason, enabled, orderId, router]);

  async function refund() {
    if (!enabled) { setMessage(disabledReason); return; }
    const amountMinor = Math.round(Number(amount) * 100);
    if (!amountMinor || amountMinor < 1) { setMessage("Укажите сумму возврата"); return; }
    if (amountMinor > refundableMinor) { setMessage("Сумма превышает доступный остаток"); return; }
    if (reason.trim().length < 3) { setMessage("Укажите причину возврата"); return; }
    const full = amountMinor === refundableMinor;
    if (!window.confirm(`${full ? "Полностью вернуть" : "Вернуть"} ${(amountMinor / 100).toFixed(2)} ₪? ${full ? "Все билеты заказа будут аннулированы." : "Билеты останутся действительными."}`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountMinor, reason: reason.trim(), requestId }),
      });
      const data = await response.json().catch(() => ({ error: "Некорректный ответ сервера" }));
      if (!response.ok) throw new Error(data.error || "Возврат не выполнен");
      setMessage(`✓ Возврат ${(data.amountMinor / 100).toFixed(2)} ₪ подтверждён HYP`);
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
    {!enabled && <div className="toast" style={{ background: "#fff8e8" }}><strong>{recovering ? "Восстанавливаем платёжную транзакцию…" : "Возврат пока недоступен"}</strong><p style={{ marginBottom: 0 }}>{recovering ? "Atlas переносит подтверждённую старую запись HYP в новую структуру возвратов." : disabledReason}</p></div>}
    <div className="form-grid two">
      <div className="field"><label>Сумма возврата, ₪</label><input className="input" type="number" min="0.01" max={(refundableMinor / 100).toFixed(2)} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} disabled={!enabled || busy || recovering}/><small className="muted">Доступно: {(refundableMinor / 100).toFixed(2)} ₪</small></div>
      <div className="field"><label>Причина</label><input className="input" value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: возврат по просьбе клиента" disabled={!enabled || busy || recovering}/></div>
    </div>
    <button type="button" className="btn" onClick={() => void refund()} disabled={!enabled || busy || recovering}>{recovering ? "Восстанавливаем транзакцию…" : busy ? "Отправляем возврат…" : "Подтвердить возврат через HYP"}</button>
    {message && <div className="toast">{message}</div>}
  </section>;
}
