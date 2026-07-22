"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

type Category = { id: string; name: string; priceMinor: number };
type MapObject = {
  id: string;
  label: string;
  objectType: "TABLE" | "SOFA";
  seats: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  priceMinor: number;
  x: number;
  y: number;
  rotation: number;
  categoryId: string;
  reserved: boolean;
};

const copy = {
  ru: {
    eyebrow: "Редактор карты",
    title: "Карта зала и назначение билетов",
    help: "Добавьте столы и диваны, разместите их на плане и назначьте тариф. Объект можно продавать целиком или по отдельным местам.",
    addTable: "+ Стол",
    addSofa: "+ Диван",
    stage: "СЦЕНА",
    label: "Название",
    seats: "Количество мест",
    sale: "Способ продажи",
    whole: "Весь объект целиком",
    perSeat: "Каждое место отдельно",
    category: "Категория билета",
    priceWhole: "Цена целиком, ₪",
    priceSeat: "Цена одного места, ₪",
    rotation: "Поворот",
    remove: "Удалить объект",
    save: "Сохранить и опубликовать карту",
    saving: "Сохраняем...",
    saved: "Карта сохранена",
    select: "Выберите объект на карте для настройки",
    reserved: "Этот объект уже участвовал в заказе и защищён от изменения.",
  },
  he: {
    eyebrow: "עורך מפה",
    title: "מפת האולם ושיוך כרטיסים",
    help: "הוסיפו שולחנות וספות, מקמו אותם במפה ושייכו מחיר. ניתן למכור אובייקט שלם או מקומות בודדים.",
    addTable: "+ שולחן",
    addSofa: "+ ספה",
    stage: "במה",
    label: "שם",
    seats: "מספר מקומות",
    sale: "אופן מכירה",
    whole: "כל האובייקט",
    perSeat: "כל מקום בנפרד",
    category: "קטגוריית כרטיס",
    priceWhole: "מחיר מלא, ₪",
    priceSeat: "מחיר למקום, ₪",
    rotation: "סיבוב",
    remove: "מחיקת אובייקט",
    save: "שמירה ופרסום המפה",
    saving: "שומר...",
    saved: "המפה נשמרה",
    select: "בחרו אובייקט במפה כדי לערוך אותו",
    reserved: "האובייקט כבר משתתף בהזמנה ומוגן משינויים.",
  },
};

function clamp(value: number) {
  return Math.max(4, Math.min(92, Math.round(value)));
}

export function VenueMapEditor({
  eventId,
  categories,
  initialObjects,
}: {
  eventId: string;
  categories: Category[];
  initialObjects: MapObject[];
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = copy[locale];
  const [objects, setObjects] = useState(initialObjects);
  const [selectedId, setSelectedId] = useState(initialObjects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId]);

  function add(objectType: MapObject["objectType"]) {
    const next: MapObject = {
      id: `new-${crypto.randomUUID()}`,
      label: objectType === "TABLE" ? `T${objects.filter((item) => item.objectType === "TABLE").length + 1}` : `S${objects.filter((item) => item.objectType === "SOFA").length + 1}`,
      objectType,
      seats: objectType === "TABLE" ? 6 : 4,
      priceMode: "WHOLE_TABLE",
      priceMinor: objectType === "TABLE" ? 180000 : 120000,
      x: 12 + (objects.length * 14) % 72,
      y: 26 + (objects.length * 13) % 58,
      rotation: 0,
      categoryId: categories[0]?.id ?? "",
      reserved: false,
    };
    setObjects((current) => [...current, next]);
    setSelectedId(next.id);
  }

  function update(patch: Partial<MapObject>) {
    setObjects((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "layout",
        objects: objects.map((item) => ({
          id: item.id.startsWith("new-") ? undefined : item.id,
          label: item.label,
          objectType: item.objectType,
          seats: item.seats,
          priceMode: item.priceMode,
          priceMinor: item.priceMinor,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          categoryId: item.categoryId,
        })),
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? text.saved : result.error);
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <section className="panel map-editor">
      <div className="map-editor-head">
        <div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p className="muted">{text.help}</p></div>
        <div className="row"><button type="button" className="btn secondary" onClick={() => add("TABLE")}>{text.addTable}</button><button type="button" className="btn secondary" onClick={() => add("SOFA")}>{text.addSofa}</button></div>
      </div>
      <div className="map-editor-grid">
        <div className="venue-canvas" aria-label={text.title}>
          <div className="map-stage">{text.stage}</div>
          {objects.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`map-object ${item.objectType.toLowerCase()} ${selectedId === item.id ? "selected" : ""}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)` }}
              onClick={() => setSelectedId(item.id)}
              onPointerMove={(event) => {
                if (event.buttons !== 1 || item.reserved) return;
                const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                if (!bounds) return;
                setSelectedId(item.id);
                setObjects((current) => current.map((entry) => entry.id === item.id ? {
                  ...entry,
                  x: clamp(((event.clientX - bounds.left) / bounds.width) * 100),
                  y: clamp(((event.clientY - bounds.top) / bounds.height) * 100),
                } : entry));
              }}
            >
              <strong>{item.label}</strong>
              <span className="object-seats">{Array.from({ length: Math.min(item.seats, 10) }, (_, index) => <i key={index} />)}</span>
              <small>{item.priceMode === "WHOLE_TABLE" ? locale === "he" ? "שלם" : "целиком" : locale === "he" ? "לפי מקום" : "по местам"}</small>
            </button>
          ))}
        </div>
        <div className="map-inspector">
          {!selected && <p className="muted">{text.select}</p>}
          {selected && <div className="form">
            {selected.reserved && <div className="toast">{text.reserved}</div>}
            <div className="field"><label>{text.label}</label><input className="input" value={selected.label} disabled={selected.reserved} onChange={(event) => update({ label: event.target.value })} /></div>
            <div className="field"><label>{text.seats}</label><input className="input" type="number" min="1" max="12" value={selected.seats} disabled={selected.reserved} onChange={(event) => update({ seats: Number(event.target.value) })} /></div>
            <div className="field"><label>{text.sale}</label><select value={selected.priceMode} disabled={selected.reserved} onChange={(event) => update({ priceMode: event.target.value as MapObject["priceMode"] })}><option value="WHOLE_TABLE">{text.whole}</option><option value="PER_SEAT">{text.perSeat}</option></select></div>
            <div className="field"><label>{text.category}</label><select value={selected.categoryId} disabled={selected.reserved} onChange={(event) => update({ categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <div className="field"><label>{selected.priceMode === "WHOLE_TABLE" ? text.priceWhole : text.priceSeat}</label><input className="input" type="number" min="1" value={selected.priceMinor / 100} disabled={selected.reserved} onChange={(event) => update({ priceMinor: Math.round(Number(event.target.value) * 100) })} /></div>
            <div className="field"><label>{text.rotation}: {selected.rotation}°</label><input type="range" min="0" max="315" step="45" value={selected.rotation} disabled={selected.reserved} onChange={(event) => update({ rotation: Number(event.target.value) })} /></div>
            {!selected.reserved && <button type="button" className="btn secondary danger" onClick={() => { setObjects((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(""); }}>{text.remove}</button>}
          </div>}
        </div>
      </div>
      <div className="row between map-save"><span className="muted">{message}</span><button type="button" className="btn" disabled={busy || objects.length === 0} onClick={() => void save()}>{busy ? text.saving : text.save}</button></div>
    </section>
  );
}
