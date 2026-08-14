"use client";

import { useState } from "react";

type Props = {
  initialEnabled: boolean;
  configured: boolean;
};

export function ValueCardIntegrationForm({ initialEnabled, configured }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/office/integrations/valuecard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled, token: token.trim() || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Не удалось сохранить интеграцию");
      setBusy(false);
      return;
    }
    setToken("");
    setSaved(true);
    setBusy(false);
  }

  return <form onSubmit={save} className="panel" style={{ maxWidth: 760, padding: 28 }}>
    <div className="row between" style={{ alignItems: "center", gap: 24 }}>
      <div>
        <h2 style={{ margin: 0 }}>Подключение ValueCard</h2>
        <p className="muted" style={{ marginBottom: 0 }}>Интеграция действует только для вашей организации.</p>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
        <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
        Включено
      </label>
    </div>

    <div className="field" style={{ marginTop: 24 }}>
      <label>ValueCard API token</label>
      <input
        className="input"
        type="password"
        value={token}
        onChange={event => setToken(event.target.value)}
        placeholder={configured ? "Токен уже сохранён. Введите новый только для замены" : "Вставьте Bearer token"}
        autoComplete="off"
      />
      <small className="muted">Токен шифруется на сервере и не возвращается обратно в браузер.</small>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
      <button className="btn dark" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
      {configured && <span className="pill">Токен сохранён</span>}
      {saved && <span style={{ color: "#15803d", fontWeight: 700 }}>Настройки сохранены</span>}
    </div>
    {error && <div className="toast" style={{ marginTop: 16 }}>{error}</div>}
  </form>;
}
