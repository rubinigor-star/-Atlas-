"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";

const copy={
  ru:{scope:"Интеграция действует только для вашей организации.",enabled:"Включено",token:"API token",configured:"Токен уже сохранён. Введите новый только для замены",paste:"Вставьте ValueCard API token",secure:"Токен хранится в зашифрованном виде и после сохранения обратно не показывается.",save:"Сохранить",saving:"Сохраняем…",saved:"Настройки сохранены",error:"Не удалось сохранить настройки"},
  he:{scope:"האינטגרציה פעילה רק עבור הארגון שלכם.",enabled:"פעיל",token:"API token",configured:"הטוקן כבר שמור. הזינו חדש רק אם רוצים להחליף אותו",paste:"הדביקו ValueCard API token",secure:"הטוקן נשמר בצורה מוצפנת ולא יוצג שוב לאחר השמירה.",save:"שמירה",saving:"שומרים…",saved:"ההגדרות נשמרו",error:"לא הצלחנו לשמור את ההגדרות"},
  en:{scope:"This integration applies only to your organization.",enabled:"Enabled",token:"API token",configured:"A token is already saved. Enter a new one only to replace it",paste:"Paste ValueCard API token",secure:"The token is stored encrypted and is not shown again after saving.",save:"Save",saving:"Saving…",saved:"Settings saved",error:"Could not save settings"}
} as const;

export function ValueCardIntegrationForm({ initialEnabled, configured }: { initialEnabled: boolean; configured: boolean }) {
  const {locale}=useLocale();
  const text=copy[locale];
  const [enabled, setEnabled] = useState(initialEnabled);
  const [token, setToken] = useState("");
  const [savedConfigured, setSavedConfigured] = useState(configured);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/office/integrations/valuecard", {method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({enabled,token:token.trim()||undefined})});
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || text.error); setBusy(false); return; }
    setSavedConfigured(Boolean(data.configured));
    setToken("");
    setMessage(text.saved);
    setBusy(false);
  }

  return <section className="panel" style={{ padding: 24, maxWidth: 760 }}>
    <div className="row between" style={{ alignItems: "center", gap: 20 }}>
      <div><h2 style={{ margin: 0 }}>ValueCard</h2><p className="muted" style={{ marginBottom: 0 }}>{text.scope}</p></div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> {text.enabled}</label>
    </div>
    <div className="field" style={{ marginTop: 24 }}>
      <label>{text.token}</label>
      <input className="input" dir="ltr" style={{textAlign:"left"}} type="password" value={token} onChange={event => setToken(event.target.value)} placeholder={savedConfigured ? text.configured : text.paste} autoComplete="new-password" />
      <small className="muted">{text.secure}</small>
    </div>
    {message && <div className="toast" style={{ marginTop: 16 }}>{message}</div>}
    <button className="btn dark" type="button" onClick={save} disabled={busy} style={{ marginTop: 18 }}>{busy ? text.saving : text.save}</button>
  </section>;
}