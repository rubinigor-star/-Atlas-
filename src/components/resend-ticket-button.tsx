"use client";

import { useState } from "react";

type Channel = "email" | "sms";

export function ResendTicketButton({ publicId, smsPriceMinor = 20 }: { publicId: string; smsPriceMinor?: number }) {
  const [busy, setBusy] = useState<Channel | null>(null);
  const [message, setMessage] = useState("");
  const smsPrice = (smsPriceMinor / 100).toFixed(2);

  async function resend(channel: Channel) {
    setBusy(channel);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${publicId}/resend-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить билет");
      setMessage(channel === "sms"
        ? `SMS с билетами отправлено на ${data.recipient}. Стоимость: ${(data.priceMinor / 100).toFixed(2)} ₪.`
        : `Билеты бесплатно отправлены на email ${data.recipient}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить билет");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" disabled={busy !== null} onClick={() => void resend("email")}>
          {busy === "email" ? "Отправляем..." : "Отправить на email - бесплатно"}
        </button>
        <button className="btn" disabled={busy !== null} onClick={() => void resend("sms")}>
          {busy === "sms" ? "Отправляем..." : `Отправить по SMS - ${smsPrice} ₪`}
        </button>
      </div>
      <small style={{ display: "block", marginTop: 8, opacity: 0.7 }}>
        SMS содержит защищенную ссылку на заказ и все билеты. PDF отправляется только по email.
      </small>
      {message && <div className="toast" style={{ marginTop: 10 }}>{message}</div>}
    </div>
  );
}
