"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: string;
  eventTitle: string;
  status: "DRAFT" | "PUBLISHED";
  archived: boolean;
};

export function EventArchiveControl({ eventId, eventTitle, status, archived }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function deleteDraft() {
    const confirmation = `Удалить черновик «${eventTitle}» безвозвратно? Удаление разрешено только если мероприятие не публиковалось и в нём нет заказов или истории продаж.`;
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/delete`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось удалить черновик");
      router.push("/admin/events");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить черновик");
    } finally {
      setBusy(false);
    }
  }

  async function changeArchiveStatus() {
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

  if (!archived && status === "DRAFT") {
    return (
      <section className="panel form" style={{ borderColor: "#fca5a5", background: "#fffafa" }}>
        <span className="eyebrow">Удаление черновика</span>
        <h2>Удалить мероприятие</h2>
        <p className="muted">
          Неопубликованный черновик без заказов и истории продаж можно удалить полностью. Это действие необратимо.
        </p>
        <button type="button" className="btn" style={{ background: "#b42318", color: "white" }} disabled={busy} onClick={deleteDraft}>
          {busy ? "Удаляю..." : "Удалить черновик"}
        </button>
        {message && <div className="toast save-feedback" role="status">{message}</div>}
      </section>
    );
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
      <button type="button" className={archived ? "btn secondary" : "btn dark"} disabled={busy} onClick={changeArchiveStatus}>
        {busy ? "Сохраняю..." : archived ? "Восстановить как черновик" : "Архивировать мероприятие"}
      </button>
      {message && <div className="toast save-feedback" role="status">{message}</div>}
    </section>
  );
}
