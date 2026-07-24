"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Method = "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "PAYPAL";

const methods: Array<{ id: Method; label: string }> = [
  { id: "CARD", label: "Банковская карта" },
  { id: "APPLE_PAY", label: "Apple Pay" },
  { id: "GOOGLE_PAY", label: "Google Pay" },
  { id: "PAYPAL", label: "PayPal" },
];

export function DemoPaymentButton({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("CARD");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/api/orders/${publicId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, cardNumber: method === "CARD" ? cardNumber : undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Не удалось завершить тестовую оплату");
      setBusy(false);
      return;
    }
    setNotice(data.emailSent ? `Оплата успешна. Билет отправлен на ${data.emailRecipient}.` : `Оплата успешна, но письмо не отправлено: ${data.emailError || "неизвестная ошибка"}`);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel" style={{ textAlign: "left" }}>
      <h3 style={{ marginTop: 0 }}>Тестовая оплата</h3>
      <p className="muted">Деньги не списываются. Apple Pay, Google Pay и PayPal пока работают как безопасная демонстрация интерфейса.</p>
      <div style={{ display: "grid", gap: 8, margin: "16px 0" }}>
        {methods.map((item) => (
          <button key={item.id} type="button" className={method === item.id ? "btn dark" : "btn"} onClick={() => setMethod(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {method === "CARD" && (
        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          <label>
            Номер тестовой карты
            <input value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} inputMode="numeric" autoComplete="cc-number" />
          </label>
          <div className="muted" style={{ fontSize: 13 }}>
            Успех: 4242 4242 4242 4242 · Ошибка: 4000 0000 0000 0002
          </div>
        </div>
      )}
      {error && <div className="toast">{error}</div>}
      {notice && <div className="toast">{notice}</div>}
      <button className="btn dark" disabled={busy} onClick={() => void pay()}>
        {busy ? "Проверяем и выпускаем билет..." : `Оплатить через ${methods.find((item) => item.id === method)?.label}`}
      </button>
    </div>
  );
}
