"use client";

import { useState } from "react";

export function ResendTicketButton({ publicId }: { publicId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function resend() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/orders/${publicId}/resend-ticket`, { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? `Билет повторно отправлен на ${data.recipient}.` : data.error || "Не удалось отправить письмо");
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button className="btn" disabled={busy} onClick={() => void resend()}>
        {busy ? "Отправляем..." : "Отправить билет повторно"}
      </button>
      {message && <div className="toast" style={{ marginTop: 10 }}>{message}</div>}
    </div>
  );
}
