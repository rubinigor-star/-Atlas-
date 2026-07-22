"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

type Category = { id: string; name: string; priceMinor: number };
type ObjectType = "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
type MapObject = {
  id: string;
  label: string;
  objectType: ObjectType;
  seats: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  priceMinor: number;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  categoryId: string | null;
  reserved: boolean;
};

const sellable = new Set<ObjectType>(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);
const presets: Record<ObjectType, Omit<MapObject, "id" | "label" | "x" | "y" | "categoryId" | "reserved">> = {
  TABLE: { objectType: "TABLE", seats: 6, priceMode: "WHOLE_TABLE", priceMinor: 180000, rotation: 0, width: 170, height: 100 },
  ROUND_TABLE: { objectType: "ROUND_TABLE", seats: 6, priceMode: "WHOLE_TABLE", priceMinor: 180000, rotation: 0, width: 130, height: 130 },
  SOFA: { objectType: "SOFA", seats: 4, priceMode: "WHOLE_TABLE", priceMinor: 120000, rotation: 0, width: 190, height: 86 },
  ROW: { objectType: "ROW", seats: 10, priceMode: "PER_SEAT", priceMinor: 24900, rotation: 0, width: 360, height: 58 },
  ZONE: { objectType: "ZONE", seats: 0, priceMode: "WHOLE_TABLE", priceMinor: 0, rotation: 0, width: 420, height: 250 },
  STAGE: { objectType: "STAGE", seats: 0, priceMode: "WHOLE_TABLE", priceMinor: 0, rotation: 0, width: 430, height: 100 },
  BAR: { objectType: "BAR", seats: 0, priceMode: "WHOLE_TABLE", priceMinor: 0, rotation: 0, width: 320, height: 72 },
  TEXT: { objectType: "TEXT", seats: 0, priceMode: "WHOLE_TABLE", priceMinor: 0, rotation: 0, width: 220, height: 54 },
};

const labels = {
  ru: {
    design: "Дизайн схемы", tickets: "Назначить билеты", addSeats: "Добавить места", addObjects: "Добавить объекты", row: "Ряд стульев", rect: "Прямоугольный стол", round: "Круглый стол", sofa: "Диван", zone: "Зона", stage: "Сцена", bar: "Бар", text: "Текст", select: "Выбор", undo: "Отменить", redo: "Повторить", preview: "Превью", save: "Сохранить", saving: "Сохраняем...", saved: "Карта сохранена", capacity: "Вместимость", nothing: "Ничего не выбрано", selectHelp: "Выберите место или объект на схеме, чтобы изменить его настройки.", settings: "Настройки объекта", label: "Название", seats: "Количество мест", size: "Размер", width: "Ширина", height: "Высота", rotation: "Поворот", remove: "Удалить", sale: "Как продавать", whole: "Целиком", perSeat: "Отдельные места", category: "Категория билета", priceWhole: "Цена объекта, ₪", priceSeat: "Цена места, ₪", locked: "Объект участвует в заказе и заблокирован для редактирования.", zoom: "Масштаб", designHint: "Сначала создайте геометрию площадки", ticketHint: "Теперь назначьте цены и способы продажи", selected: "Выбрано", object: "объект", objects: "объектов",
  },
  he: {
    design: "עיצוב המפה", tickets: "שיוך כרטיסים", addSeats: "הוספת מקומות", addObjects: "הוספת אובייקטים", row: "שורת כיסאות", rect: "שולחן מלבני", round: "שולחן עגול", sofa: "ספה", zone: "אזור", stage: "במה", bar: "בר", text: "טקסט", select: "בחירה", undo: "ביטול", redo: "חזרה", preview: "תצוגה מקדימה", save: "שמירה", saving: "שומר...", saved: "המפה נשמרה", capacity: "קיבולת", nothing: "לא נבחר דבר", selectHelp: "בחרו מקום או אובייקט במפה כדי לשנות את ההגדרות שלו.", settings: "הגדרות אובייקט", label: "שם", seats: "מספר מקומות", size: "גודל", width: "רוחב", height: "גובה", rotation: "סיבוב", remove: "מחיקה", sale: "אופן מכירה", whole: "הכול יחד", perSeat: "מקומות בודדים", category: "קטגוריית כרטיס", priceWhole: "מחיר אובייקט, ₪", priceSeat: "מחיר למקום, ₪", locked: "האובייקט משתתף בהזמנה ונעול לעריכה.", zoom: "קנה מידה", designHint: "תחילה צרו את מבנה המקום", ticketHint: "כעת שייכו מחירים ואופן מכירה", selected: "נבחר", object: "אובייקט", objects: "אובייקטים",
  },
};

function clamp(value: number) { return Math.max(3, Math.min(97, Math.round(value))); }

function PaletteIcon({ type }: { type: ObjectType }) {
  if (type === "ROUND_TABLE") return <span className="palette-symbol round-symbol"><i /><b /><b /><b /><b /></span>;
  if (type === "TABLE") return <span className="palette-symbol table-symbol"><i /><b /><b /><b /><b /></span>;
  if (type === "SOFA") return <span className="palette-symbol sofa-symbol"><i /><b /><b /><b /></span>;
  if (type === "ROW") return <span className="palette-symbol row-symbol">● ● ●</span>;
  if (type === "ZONE") return <span className="palette-symbol zone-symbol">A</span>;
  if (type === "STAGE") return <span className="palette-symbol">▰</span>;
  if (type === "BAR") return <span className="palette-symbol">▭</span>;
  return <span className="palette-symbol">T</span>;
}

function SeatDots({ item }: { item: MapObject }) {
  if (!sellable.has(item.objectType)) return null;
  if (item.objectType === "SOFA") return <span className="sofa-cushions">{Array.from({ length: item.seats }, (_, index) => <i key={index}>{index + 1}</i>)}</span>;
  if (item.objectType === "ROW") return <span className="row-chairs">{Array.from({ length: item.seats }, (_, index) => <i key={index}>{index + 1}</i>)}</span>;
  if (item.objectType === "ROUND_TABLE") return <>{Array.from({ length: item.seats }, (_, index) => { const angle = (index / item.seats) * Math.PI * 2 - Math.PI / 2; return <i className="radial-chair" key={index} style={{ left: `${50 + Math.cos(angle) * 58}%`, top: `${50 + Math.sin(angle) * 58}%` }}>{index + 1}</i>; })}</>;
  return <>{Array.from({ length: item.seats }, (_, index) => { const top = index < Math.ceil(item.seats / 2); const slot = top ? index : index - Math.ceil(item.seats / 2); const count = top ? Math.ceil(item.seats / 2) : Math.floor(item.seats / 2); return <i className="edge-chair" key={index} style={{ left: `${((slot + 1) / (count + 1)) * 100}%`, top: top ? "-16px" : "calc(100% + 16px)" }}>{index + 1}</i>; })}</>;
}

function ObjectShape({ item, ticketMode }: { item: MapObject; ticketMode: boolean }) {
  if (item.objectType === "ZONE") return <div className="shape-zone"><strong>{item.label}</strong></div>;
  if (item.objectType === "STAGE") return <div className="shape-stage"><span>✦</span><strong>{item.label}</strong><span>✦</span></div>;
  if (item.objectType === "BAR") return <div className="shape-bar"><strong>{item.label}</strong></div>;
  if (item.objectType === "TEXT") return <div className="shape-text">{item.label}</div>;
  return <div className={`furniture ${item.objectType.toLowerCase()} ${ticketMode ? "ticket-mode" : ""}`}><div className="furniture-core"><strong>{item.label}</strong>{ticketMode && <small>{item.priceMode === "WHOLE_TABLE" ? "1×" : `${item.seats}×`}</small>}</div><SeatDots item={item} /></div>;
}

export function VenueMapEditor({ eventId, categories, initialObjects }: { eventId: string; categories: Category[]; initialObjects: MapObject[] }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = labels[locale];
  const [objects, setObjects] = useState(initialObjects);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"design" | "tickets">("design");
  const [zoom, setZoom] = useState(75);
  const [history, setHistory] = useState<MapObject[][]>([]);
  const [future, setFuture] = useState<MapObject[][]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId]);
  const capacity = objects.filter((item) => sellable.has(item.objectType)).reduce((sum, item) => sum + item.seats, 0);
  const scale = zoom / 100;

  function commit(next: MapObject[]) { setHistory((current) => [...current.slice(-29), objects]); setFuture([]); setObjects(next); }
  function update(patch: Partial<MapObject>) { commit(objects.map((item) => item.id === selectedId ? { ...item, ...patch } : item)); }
  function undo() { const previous = history.at(-1); if (!previous) return; setFuture((current) => [objects, ...current]); setObjects(previous); setHistory((current) => current.slice(0, -1)); setSelectedId(""); }
  function redo() { const next = future[0]; if (!next) return; setHistory((current) => [...current, objects]); setObjects(next); setFuture((current) => current.slice(1)); setSelectedId(""); }

  function add(type: ObjectType) {
    const base = presets[type];
    const sameType = objects.filter((item) => item.objectType === type).length + 1;
    const names: Record<ObjectType, string> = { TABLE: "T", ROUND_TABLE: "R", SOFA: "S", ROW: "ROW", ZONE: locale === "he" ? "אזור" : "Зона", STAGE: locale === "he" ? "במה" : "Сцена", BAR: locale === "he" ? "בר" : "Бар", TEXT: locale === "he" ? "טקסט" : "Текст" };
    const item: MapObject = { ...base, id: `new-${crypto.randomUUID()}`, label: `${names[type]}${["ZONE", "STAGE", "BAR", "TEXT"].includes(type) ? "" : sameType}`, x: 35 + (objects.length * 8) % 34, y: 32 + (objects.length * 9) % 48, categoryId: sellable.has(type) ? categories[0]?.id ?? null : null, reserved: false };
    commit([...objects, item]); setSelectedId(item.id);
  }

  async function save() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/events/${eventId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "layout", objects: objects.map((item) => ({ id: item.id.startsWith("new-") ? undefined : item.id, label: item.label, objectType: item.objectType, seats: item.seats, priceMode: item.priceMode, priceMinor: item.priceMinor, x: item.x, y: item.y, rotation: item.rotation, width: item.width, height: item.height, categoryId: item.categoryId })) }) });
    const result = await response.json(); setMessage(response.ok ? t.saved : result.error); setBusy(false); if (response.ok) router.refresh();
  }

  const palette: Array<{ title: string; items: Array<[ObjectType, string]> }> = [
    { title: t.addSeats, items: [["ROW", t.row], ["TABLE", t.rect], ["ROUND_TABLE", t.round], ["SOFA", t.sofa], ["ZONE", t.zone]] },
    { title: t.addObjects, items: [["STAGE", t.stage], ["BAR", t.bar], ["TEXT", t.text]] },
  ];

  return <section className="venue-builder">
    <header className="builder-topbar">
      <div className="builder-title"><span className="eyebrow">Atlas venue builder</span><strong>{locale === "he" ? "מפת האירוע" : "Карта мероприятия"}</strong></div>
      <div className="builder-tabs"><button className={mode === "design" ? "active" : ""} onClick={() => setMode("design")}>{t.design}</button><button className={mode === "tickets" ? "active" : ""} onClick={() => setMode("tickets")}>{t.tickets}</button></div>
      <div className="builder-actions"><button className="icon-btn" title={t.undo} disabled={!history.length} onClick={undo}>↶</button><button className="icon-btn" title={t.redo} disabled={!future.length} onClick={redo}>↷</button><button className="btn secondary">{t.preview}</button><button className="btn" disabled={busy || !objects.length} onClick={() => void save()}>{busy ? t.saving : t.save}</button></div>
    </header>

    <div className="builder-body">
      <aside className="object-library">{palette.map((group) => <div className="library-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([type, title]) => <button key={type} onClick={() => add(type)}><PaletteIcon type={type} /><span>{title}</span></button>)}</div>)}</aside>

      <main className="builder-workspace">
        <div className="floating-tools"><button className="tool-active" title={t.select}>↖</button><button title={t.undo} onClick={undo}>↶</button><span /><button onClick={() => setZoom((value) => Math.max(35, value - 10))}>−</button><strong>{zoom}%</strong><button onClick={() => setZoom((value) => Math.min(125, value + 10))}>＋</button></div>
        <div className="workspace-hint">{mode === "design" ? t.designHint : t.ticketHint}</div>
        <div className="map-scroll"><div className="map-world-frame" style={{ width: 1000 * scale, height: 700 * scale }}><div className={`map-world ${mode}`} style={{ transform: `scale(${scale})` }} onClick={() => setSelectedId("")}>
          {objects.map((item) => <button type="button" key={item.id} className={`editor-object object-${item.objectType.toLowerCase()} ${selectedId === item.id ? "selected" : ""} ${item.reserved ? "locked" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: item.width, height: item.height, transform: `translate(-50%,-50%) rotate(${item.rotation}deg)`, zIndex: item.objectType === "ZONE" ? 1 : 2 }} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} onPointerMove={(event) => { if (event.buttons !== 1 || item.reserved) return; const bounds = event.currentTarget.parentElement?.getBoundingClientRect(); if (!bounds) return; setSelectedId(item.id); setObjects((current) => current.map((entry) => entry.id === item.id ? { ...entry, x: clamp(((event.clientX - bounds.left) / bounds.width) * 100), y: clamp(((event.clientY - bounds.top) / bounds.height) * 100) } : entry)); }}><ObjectShape item={item} ticketMode={mode === "tickets"} /></button>)}
        </div></div></div>
        <div className="builder-status"><span>{message || `${objects.length} ${objects.length === 1 ? t.object : t.objects}`}</span><span>{t.capacity}: <strong>{capacity}</strong></span></div>
      </main>

      <aside className="property-panel"><div className="capacity-card"><span>{t.capacity}</span><strong>{capacity}</strong></div>{!selected ? <div className="empty-inspector"><span>↖</span><h3>{t.nothing}</h3><p>{t.selectHelp}</p></div> : <div className="inspector-content"><span className="eyebrow">{mode === "design" ? t.design : t.tickets}</span><h3>{t.settings}</h3>{selected.reserved && <div className="toast">{t.locked}</div>}<div className="field"><label>{t.label}</label><input className="input" value={selected.label} disabled={selected.reserved} onChange={(event) => update({ label: event.target.value })} /></div>{sellable.has(selected.objectType) && <div className="field"><label>{t.seats}</label><input className="input" type="number" min="1" max="50" value={selected.seats} disabled={selected.reserved} onChange={(event) => update({ seats: Number(event.target.value) })} /></div>}{mode === "design" ? <><div className="property-pair"><div className="field"><label>{t.width}</label><input className="input" type="number" min="40" value={selected.width} onChange={(event) => update({ width: Number(event.target.value) })} /></div><div className="field"><label>{t.height}</label><input className="input" type="number" min="30" value={selected.height} onChange={(event) => update({ height: Number(event.target.value) })} /></div></div><div className="field"><label>{t.rotation}: {selected.rotation}°</label><input type="range" min="0" max="345" step="15" value={selected.rotation} onChange={(event) => update({ rotation: Number(event.target.value) })} /></div></> : sellable.has(selected.objectType) ? <><div className="segmented"><button className={selected.priceMode === "WHOLE_TABLE" ? "active" : ""} onClick={() => update({ priceMode: "WHOLE_TABLE" })}>{t.whole}</button><button className={selected.priceMode === "PER_SEAT" ? "active" : ""} onClick={() => update({ priceMode: "PER_SEAT" })}>{t.perSeat}</button></div><div className="field"><label>{t.category}</label><select value={selected.categoryId ?? ""} onChange={(event) => update({ categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="field"><label>{selected.priceMode === "WHOLE_TABLE" ? t.priceWhole : t.priceSeat}</label><input className="input" type="number" min="1" value={selected.priceMinor / 100} onChange={(event) => update({ priceMinor: Math.round(Number(event.target.value) * 100) })} /></div></> : <p className="muted">{locale === "he" ? "זהו אובייקט עיצובי ואינו נמכר." : "Это декоративный объект, билеты к нему не назначаются."}</p>}{!selected.reserved && <button className="delete-object" onClick={() => { commit(objects.filter((item) => item.id !== selected.id)); setSelectedId(""); }}>{t.remove}</button>}</div>}</aside>
    </div>
  </section>;
}
