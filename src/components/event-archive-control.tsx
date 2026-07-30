"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: string;
  eventTitle: string;
  archived: boolean;
};

export function EventArchiveControl({ eventId, eventTitle, archived }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function changeStatus() {
    const confirmation = archived
      ? `Восстановить мероприятие «${eventTitle}» как черновик? Оно не появится в афише, пока вы снова его не опубликуете.`
      : `Архивировать мероприятие «${eventTitle}»? Оно сразу исчезнет из публичной афиши, а заказы и билеты сохранятся.`;
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/archive`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: archived ? "restore" : "archive" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось изменить статус мероприятия");
      setMessage(archived ? "Мероприятие восстановлено как черновик." : "Мероприятие архивировано и удалено из афиши.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить статус мероприятия");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form" style={{ borderColor: archived ? "#94a3b8" : "#f59e0b" }}>
      <span className="eyebrow">Жизненный цикл мероприятия</span>
      <h2>{archived ? "Мероприятие находится в архиве" : "Архивирование мероприятия"}</h2>
      <p className="muted">
        {archived
          ? "Заказы, билеты, статистика и настройки сохранены. После восстановления мероприятие станет черновиком и не будет опубликовано автоматически."
          : "Архивирование немедленно скрывает мероприятие из публичной афиши и закрывает продажу. Заказы, билеты и история остаются доступными в кабинете."}
      </p>
      <button type="button" className={archived ? "btn secondary" : "btn dark"} disabled={busy} onClick={changeStatus}>
        {busy ? "Сохраняю..." : archived ? "Восстановить как черновик" : "Архивировать мероприятие"}
      </button>
      {message && <div className="toast save-feedback" role="status">{message}</div>}
    </section>
  );
}
