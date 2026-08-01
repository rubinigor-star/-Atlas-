"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StopAbandonedRemindersButton({ checkoutId }: { checkoutId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function stop() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/office/abandoned/${checkoutId}/stop`, { method: "POST" });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(body.error === "CHECKOUT_NOT_ACTIVE" ? "Сценарий уже остановлен." : body.error || "Не удалось остановить напоминания.");
      setBusy(false);
      return;
    }

    setMessage("Будущие напоминания остановлены.");
    setBusy(false);
    router.refresh();
  }

  return <div>
    <button className="btn" type="button" disabled={busy} onClick={() => void stop()}>
      {busy ? "Останавливаем..." : "Остановить напоминания"}
    </button>
    {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
  </div>;
}
