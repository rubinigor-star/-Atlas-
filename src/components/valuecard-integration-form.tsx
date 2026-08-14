"use client";

import { useState } from "react";

export function ValueCardIntegrationForm({ initialEnabled, configured }: { initialEnabled: boolean; configured: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [token, setToken] = useState("");
  const [savedConfigured, setSavedConfigured] = useState(configured);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/office/integrations/valuecard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled, token: token.trim() || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Не удалось сохранить настройки");
      setBusy(false);
      return;
    }
    setSavedConfigured(Boolean(data.configured));
    setToken("");
    setMessage("Настройки сохранены");
    setBusy(false);
  }

  return <section className="panel" style={{ padding: 24, maxWidth: 760 }}>
    <div className="row between" style={{ alignItems: "center", gap: 20 }}>
      <div><h2 style={{ margin: 0 }}>ValueCard</h2><p className="muted" style={{ marginBottom: 0 }}>Интеграция действует только для вашей организации.</p></div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Включено</label>
    </div>
    <div className="field" style={{ marginTop: 24 }}>
      <label>API token</label>
      <input className="input" type="password" value={token} onChange={event => setToken(event.target.value)} placeholder={savedConfigured ? "Токен уже сохранён. Введите новый только для замены" : "Вставьте ValueCard API token"} autoComplete="new-password" />
      <small className="muted">Токен хранится в зашифрованном виде и после сохранения обратно не показывается.</small>
    </div>
    {message && <div className="toast" style={{ marginTop: 16 }}>{message}</div>}
    <button className="btn dark" type="button" onClick={save} disabled={busy} style={{ marginTop: 18 }}>{busy ? "Сохраняем…" : "Сохранить"}</button>
  </section>;
}
