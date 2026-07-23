"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Guest = { id: string; name: string; phone: string; ticketStatus: string };

export function GuestListPage({ code, token, title, eventTitle, allocation, limit, guests, canManage }: { code: string; token: string; title: string; eventTitle: string; allocation: string; limit: number; guests: Guest[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const key = `atlas-guest-session-${code}`;
    let sessionId = localStorage.getItem(key);
    if (!sessionId) { sessionId = crypto.randomUUID(); localStorage.setItem(key, sessionId); }
    void fetch(`/api/guest-lists/${code}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "visit", sessionId }) });
  }, [code]);

  async function send(body: Record<string, unknown>) {
    setBusy(true); setError("");
    const response = await fetch(`/api/guest-lists/${code}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error || "Ошибка");
    router.refresh();
  }

  return <main className="shell">
    <section className="panel" style={{ maxWidth: 720, margin: "28px auto" }}>
      <span className="eyebrow">ATLAS GUEST LIST</span>
      <h1>{title}</h1>
      <p><strong>{eventTitle}</strong><br /><span className="muted">{allocation}</span></p>
      <div className="stats"><div className="stat"><span className="muted">Записано</span><strong>{guests.length}</strong></div><div className="stat"><span className="muted">Осталось</span><strong>{Math.max(0, limit - guests.length)}</strong></div></div>

      {canManage && guests.length < limit && <form className="form panel" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: "add", token, name: f.get("name"), phone: f.get("phone"), email: f.get("email") }); e.currentTarget.reset(); }}>
        <h2>Добавить гостя</h2>
        <div className="field"><label>Имя и фамилия</label><input className="input" name="name" required minLength={2} /></div>
        <div className="field"><label>Телефон</label><input className="input" name="phone" required placeholder="+972..." /></div>
        <div className="field"><label>Email — необязательно</label><input className="input" name="email" type="email" /></div>
        {error && <div className="toast">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? "Добавляем..." : "Добавить и выдать билет"}</button>
      </form>}

      <h2 className="section-title">Список гостей</h2>
      <div className="table-wrap"><table><thead><tr><th>Гость</th><th>Телефон</th><th>Статус</th>{canManage && <th />}</tr></thead><tbody>
        {guests.map((guest) => <tr key={guest.id}><td><strong>{guest.name}</strong></td><td>{guest.phone}</td><td><span className="pill">{guest.ticketStatus === "USED" ? "Прошёл" : "Билет выдан"}</span></td>{canManage && <td><button type="button" className="btn secondary" disabled={busy || guest.ticketStatus === "USED"} onClick={() => void send({ action: "remove", token, orderId: guest.id })}>Удалить</button></td>}</tr>)}
        {!guests.length && <tr><td colSpan={canManage ? 4 : 3}>Пока никто не записан.</td></tr>}
      </tbody></table></div>
      {!canManage && <p className="muted">Это публичный просмотр списка. Добавлять и удалять гостей можно только по защищённой ссылке управления.</p>}
    </section>
  </main>;
}
