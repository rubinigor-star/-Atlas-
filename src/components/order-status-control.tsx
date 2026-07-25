"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const meta: Record<string, { label: string; background: string; color: string }> = {
  PENDING: { label: "Создан", background: "#f3f4f6", color: "#374151" },
  PENDING_APPROVAL: { label: "Ожидает одобрения", background: "#fff4cc", color: "#8a5a00" },
  AWAITING_PAYMENT: { label: "Одобрен · ждёт оплату", background: "#dbeafe", color: "#1d4ed8" },
  PAID: { label: "Оплачен", background: "#dcfce7", color: "#166534" },
  REJECTED: { label: "Отклонён", background: "#fee2e2", color: "#b91c1c" },
  CANCELLED: { label: "Отменён", background: "#e5e7eb", color: "#4b5563" },
};

export function OrderStatusControl({ publicId, initialStatus, canReview }: { publicId: string; initialStatus: string; canReview: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = meta[status] || { label: status, background: "#e5e7eb", color: "#111827" };

  async function update(action: "approve" | "reject") {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${publicId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, note: action === "approve" ? "Одобрено из последних заказов" : "Отклонено из последних заказов" }),
    });
    const data = await response.json();
    if (data.status) setStatus(data.status);
    setMessage(response.ok
      ? data.emailSent
        ? "Статус обновлён, email отправлен"
        : `Статус обновлён${data.emailError ? `, email: ${data.emailError}` : ""}`
      : data.error || "Не удалось изменить статус");
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 190 }}>
      <span className="pill" style={{ background: current.background, color: current.color, width: "fit-content" }}>{current.label}</span>
      {status === "PENDING_APPROVAL" && canReview && (
        <select
          className="input"
          value=""
          disabled={busy}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "approve" || value === "reject") void update(value);
          }}
        >
          <option value="" disabled>{busy ? "Обрабатываем…" : "Изменить статус"}</option>
          <option value="approve">Одобрить → оплатить → выдать билет</option>
          <option value="reject">Отклонить</option>
        </select>
      )}
      {message && <small style={{ color: message.startsWith("Не удалось") ? "#b42318" : "#166534" }}>{message}</small>}
    </div>
  );
}
