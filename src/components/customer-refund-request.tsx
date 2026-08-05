"use client";

import { useState } from "react";

export function CustomerRefundRequest({ publicId, totalMinor, customerEmail }: { publicId: string; totalMinor: number; customerEmail: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState((totalMinor / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    const amountMinor = Math.round(Number(amount) * 100);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > totalMinor) {
      setMessage("Проверьте сумму возврата");
      return;
    }
    if (reason.trim().length < 3) {
      setMessage("Укажите причину возврата");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(publicId)}/refund-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: customerEmail, amountMinor, reason: reason.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось отправить запрос");
      setMessage("Запрос на возврат отправлен организатору.");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel" style={{ marginTop: 20, textAlign: "left" }}>
    <h2 style={{ marginTop: 0 }}>Возврат билетов</h2>
    <p className="muted">Отправьте запрос организатору. Деньги возвращаются только после его подтверждения и успешного ответа HYP.</p>
    {!open ? <button className="btn secondary" type="button" onClick={() => setOpen(true)}>Запросить возврат</button> : <div className="form">
      <div className="field"><label>Сумма, ₪</label><input className="input" type="number" min="0.01" max={(totalMinor / 100).toFixed(2)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
      <div className="field"><label>Причина</label><textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Опишите причину возврата" /></div>
      <div className="row"><button className="btn" type="button" disabled={busy} onClick={() => void submit()}>{busy ? "Отправляем…" : "Отправить запрос"}</button><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Отмена</button></div>
    </div>}
    {message && <div className="toast" style={{ marginTop: 12 }}>{message}</div>}
  </section>;
}
