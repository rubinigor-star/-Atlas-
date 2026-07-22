"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoPaymentButton({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    const response = await fetch(`/api/orders/${publicId}/pay`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Не удалось завершить тестовую оплату");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <div className="toast">{error}</div>}
      <button className="btn" disabled={busy} onClick={() => void pay()}>
        {busy ? "Оформляем билет..." : "Оплатить тестово и получить билет"}
      </button>
    </div>
  );
}
