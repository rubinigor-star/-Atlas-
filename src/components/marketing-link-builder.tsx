"use client";

import { useMemo, useState } from "react";

export type MarketingEventOption = { id: string; title: string; publicUrl: string };

export function MarketingLinkBuilder({ events }: { events: MarketingEventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("paid_social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const event = events.find((item) => item.id === eventId);
  const url = useMemo(() => {
    if (!event) return "";
    const target = new URL(event.publicUrl, typeof window === "undefined" ? "https://atlas.local" : window.location.origin);
    if (source.trim()) target.searchParams.set("utm_source", source.trim());
    if (medium.trim()) target.searchParams.set("utm_medium", medium.trim());
    if (campaign.trim()) target.searchParams.set("utm_campaign", campaign.trim());
    if (content.trim()) target.searchParams.set("utm_content", content.trim());
    return target.toString().replace("https://atlas.local", "");
  }, [event, source, medium, campaign, content]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url.startsWith("http") ? url : `${window.location.origin}${url}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <div className="card">
    <div className="row between"><div><span className="eyebrow">UTM-конструктор</span><h2>Рекламная ссылка</h2></div><span className="pill">Atlas tracking</span></div>
    {events.length === 0 ? <p className="muted">Сначала создайте мероприятие — после этого здесь появится генератор рекламных ссылок.</p> : <>
      <div className="form-grid">
        <label>Мероприятие<select value={eventId} onChange={(e)=>setEventId(e.target.value)}>{events.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Источник<input value={source} onChange={(e)=>setSource(e.target.value)} placeholder="facebook" /></label>
        <label>Канал<input value={medium} onChange={(e)=>setMedium(e.target.value)} placeholder="paid_social" /></label>
        <label>Кампания<input value={campaign} onChange={(e)=>setCampaign(e.target.value)} placeholder="event_launch" /></label>
        <label>Объявление / партнёр<input value={content} onChange={(e)=>setContent(e.target.value)} placeholder="video_1 или blogger_anna" /></label>
      </div>
      <div className="card" style={{marginTop:16}}><small className="muted">Готовая ссылка</small><p style={{overflowWrap:"anywhere",marginBottom:12}}><strong>{url}</strong></p><button className="btn" type="button" onClick={copy}>{copied?"Скопировано":"Скопировать ссылку"}</button></div>
    </>}
  </div>;
}
