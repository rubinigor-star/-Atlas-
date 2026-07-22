"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateEventForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let posterUrl = "/assets/noa-live-tel-aviv.png";
    const poster = form.get("poster");
    if (poster instanceof File && poster.size) {
      const upload = new FormData();
      upload.set("poster", poster);
      const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setError(uploadData.error);
        setBusy(false);
        return;
      }
      posterUrl = uploadData.url;
    }

    const payload = {
      title: form.get("title"),
      slug: form.get("slug"),
      description: form.get("description"),
      startsAt: new Date(String(form.get("startsAt"))).toISOString(),
      venueName: form.get("venueName"),
      city: form.get("city"),
      categoryName: form.get("categoryName"),
      priceMinor: Math.round(Number(form.get("price")) * 100),
      capacity: Number(form.get("capacity")),
      salesMode: form.get("salesMode"),
      approvalInstructions: form.get("approvalInstructions"),
      posterUrl,
    };
    const response = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    router.push(`/admin/events/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={`panel form ${busy ? "loading" : ""}`}>
      <div className="field"><label>Название</label><input className="input" name="title" required /></div>
      <div className="field"><label>URL slug</label><input className="input" name="slug" pattern="[a-z0-9-]+" required placeholder="event-name-2026" /></div>
      <div className="field"><label>Описание</label><textarea name="description" rows={5} required minLength={20} /></div>
      <div className="field"><label>Афиша JPG или PNG</label><input className="input" name="poster" type="file" accept="image/jpeg,image/png,image/webp" /></div>
      <div className="field"><label>Дата и время</label><input className="input" name="startsAt" type="datetime-local" required /></div>
      <div className="row"><div className="field" style={{ flex: 1 }}><label>Площадка</label><input className="input" name="venueName" required /></div><div className="field" style={{ flex: 1 }}><label>Город</label><input className="input" name="city" required /></div></div>

      <h3>Режим продажи</h3>
      <label className="option"><span><strong>Автоматическая продажа</strong><small>Билет выдаётся сразу после оплаты.</small></span><input type="radio" name="salesMode" value="INSTANT" defaultChecked /></label>
      <label className="option"><span><strong>Только после моего одобрения</strong><small>Сначала заявка, затем проверка, оплата и билет.</small></span><input type="radio" name="salesMode" value="APPROVAL_REQUIRED" /></label>
      <div className="field"><label>Вопрос или требование к клиенту</label><textarea name="approvalInstructions" rows={2} defaultValue="Укажите номер клубной карты или кто вас пригласил" /></div>

      <h3>Первая категория билетов</h3>
      <div className="row"><div className="field" style={{ flex: 1 }}><label>Название</label><input className="input" name="categoryName" defaultValue="General Admission" required /></div><div className="field"><label>Цена, ₪</label><input className="input" name="price" type="number" min="1" required /></div><div className="field"><label>Количество</label><input className="input" name="capacity" type="number" min="1" required /></div></div>
      {error && <div className="toast">{error}</div>}
      <button className="btn">Создать и опубликовать</button>
    </form>
  );
}
