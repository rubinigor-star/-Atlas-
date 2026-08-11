"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { isReadingVenue, readingVenuePreset, READING_PRESET_MARKER } from "@/lib/venue-map-presets";
import { useLocale, type Locale } from "@/components/locale-provider";
import mapStyle from "./venue-map-editor-atlas.module.css";

type Category = { id: string; name: string; priceMinor: number; colorHex: string };
type ObjectType = "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
type SeatAssignment = { position: number; categoryId: string | null };
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
  seatAssignments: SeatAssignment[];
};

type Copy = {
  design: string; tickets: string; save: string; saved: string; saving: string; settings: string;
  addSeats: string; addObjects: string; customObjects: string; customRect: string; customOval: string;
  customRow: string; customHelp: string; row: string; table: string; round: string; sofa: string;
  zone: string; stage: string; bar: string; text: string; label: string; seats: string; width: string;
  height: string; rotation: string; whole: string; perSeat: string; ticket: string; assign: string;
  clear: string; selectedSeats: string; selectHelp: string; designHelp: string; ticketHelp: string;
  legend: string; unassigned: string; remove: string; capacity: string; left: string; right: string;
  mapTitle: string; saveError: string;
};

const copy: Record<Locale, Copy> = {
  ru: { design:"Дизайн схемы",tickets:"Назначить билеты",save:"Сохранить",saved:"Карта сохранена",saving:"Сохраняем…",settings:"Настройки",addSeats:"Добавить места",addObjects:"Добавить объекты",customObjects:"Свой объект",customRect:"Прямоугольник",customOval:"Круг или овал",customRow:"Ряд мест",customHelp:"Добавьте основу и настройте размер, поворот, места и продажу справа.",row:"Ряд",table:"Прямоугольный стол",round:"Круглый стол",sofa:"Диван",zone:"Зона",stage:"Сцена",bar:"Бар",text:"Текст",label:"Название",seats:"Количество мест",width:"Ширина",height:"Высота",rotation:"Поворот",whole:"Продавать целиком",perSeat:"Продавать по местам",ticket:"Тип билета",assign:"Назначить билет",clear:"Очистить назначение",selectedSeats:"Выбрано мест",selectHelp:"Выберите объект или места на карте",designHelp:"Перетаскивайте объекты. Позиции автоматически выравниваются по внутренней сетке.",ticketHelp:"Выберите место, стол или зону, затем назначьте уже созданный тип билета.",legend:"Легенда билетов",unassigned:"Билет не назначен",remove:"Удалить объект",capacity:"Вместимость",left:"Повернуть влево",right:"Повернуть вправо",mapTitle:"Карта мероприятия",saveError:"Не удалось сохранить карту" },
  he: { design:"עיצוב המפה",tickets:"שיוך כרטיסים",save:"שמירה",saved:"המפה נשמרה",saving:"שומר…",settings:"הגדרות",addSeats:"הוספת מקומות",addObjects:"הוספת אובייקטים",customObjects:"אובייקט מותאם",customRect:"מלבן",customOval:"עיגול או אליפסה",customRow:"שורת מושבים",customHelp:"הוסיפו בסיס והתאימו גודל, סיבוב, מושבים ומכירה בחלונית הימנית.",row:"שורה",table:"שולחן מלבני",round:"שולחן עגול",sofa:"ספה",zone:"אזור",stage:"במה",bar:"בר",text:"טקסט",label:"שם",seats:"מספר מקומות",width:"רוחב",height:"גובה",rotation:"סיבוב",whole:"מכירה שלמה",perSeat:"מכירה לפי מקומות",ticket:"סוג כרטיס",assign:"שיוך כרטיס",clear:"ניקוי שיוך",selectedSeats:"מקומות שנבחרו",selectHelp:"בחרו אובייקט או מקומות במפה",designHelp:"גררו אובייקטים. המיקומים מיושרים אוטומטית לרשת פנימית.",ticketHelp:"בחרו מקום, שולחן או אזור ושייכו סוג כרטיס שכבר נוצר.",legend:"מקרא כרטיסים",unassigned:"לא שויך כרטיס",remove:"מחיקת אובייקט",capacity:"קיבולת",left:"סיבוב שמאלה",right:"סיבוב ימינה",mapTitle:"מפת האירוע",saveError:"לא ניתן לשמור את המפה" },
  en: { design:"Map design",tickets:"Assign tickets",save:"Save",saved:"Map saved",saving:"Saving…",settings:"Settings",addSeats:"Add seating",addObjects:"Add objects",customObjects:"Custom object",customRect:"Rectangle",customOval:"Circle or oval",customRow:"Seat row",customHelp:"Add a base object, then configure its size, rotation, seats and sales settings on the right.",row:"Row",table:"Rectangular table",round:"Round table",sofa:"Sofa",zone:"Zone",stage:"Stage",bar:"Bar",text:"Text",label:"Label",seats:"Number of seats",width:"Width",height:"Height",rotation:"Rotation",whole:"Sell as a whole",perSeat:"Sell by seat",ticket:"Ticket type",assign:"Assign ticket",clear:"Clear assignment",selectedSeats:"Selected seats",selectHelp:"Select an object or seats on the map",designHelp:"Drag objects to reposition them. Positions snap to an internal alignment grid.",ticketHelp:"Select a seat, table or zone, then assign an existing ticket type.",legend:"Ticket legend",unassigned:"No ticket assigned",remove:"Delete object",capacity:"Capacity",left:"Rotate left",right:"Rotate right",mapTitle:"Event map",saveError:"Could not save the map" }
};

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const seatBased = new Set<ObjectType>(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);
const ticketAssignable = new Set<ObjectType>(["TABLE", "ROUND_TABLE", "SOFA", "ROW", "ZONE"]);
const preset: Record<ObjectType, Pick<MapObject, "seats" | "priceMode" | "rotation" | "width" | "height">> = {
  TABLE:{seats:6,priceMode:"WHOLE_TABLE",rotation:0,width:72,height:56},
  ROUND_TABLE:{seats:6,priceMode:"WHOLE_TABLE",rotation:0,width:64,height:64},
  SOFA:{seats:4,priceMode:"WHOLE_TABLE",rotation:0,width:110,height:54},
  ROW:{seats:12,priceMode:"PER_SEAT",rotation:0,width:220,height:24},
  ZONE:{seats:0,priceMode:"WHOLE_TABLE",rotation:0,width:420,height:260},
  STAGE:{seats:0,priceMode:"WHOLE_TABLE",rotation:0,width:300,height:52},
  BAR:{seats:0,priceMode:"WHOLE_TABLE",rotation:0,width:220,height:42},
  TEXT:{seats:0,priceMode:"WHOLE_TABLE",rotation:0,width:160,height:40},
};

function clamp(value: number) { return Math.max(2, Math.min(98, Math.round(value))); }
function norm(value: number) { return ((Math.round(value) % 360) + 360) % 360; }
function assignments(count: number, current: SeatAssignment[], fallback: string | null = null) {
  return Array.from({ length: count }, (_, index) => current.find((item) => item.position === index + 1) ?? { position: index + 1, categoryId: fallback });
}
function colorFor(item: MapObject, position: number, categories: Category[]) {
  const id = item.priceMode === "WHOLE_TABLE" ? item.categoryId : item.seatAssignments.find((seat) => seat.position === position)?.categoryId;
  return categories.find((category) => category.id === id)?.colorHex ?? "#E1E6EA";
}
function isPresetMarker(item: MapObject) { return item.label === READING_PRESET_MARKER; }

function prepareInitialObjects(initialObjects: MapObject[], venueName?: string): MapObject[] {
  const normalized = initialObjects.map((item) => ({ ...item, seatAssignments: assignments(item.seats, item.seatAssignments ?? [], item.categoryId) }));
  if (!isReadingVenue(venueName ?? "")) return normalized;
  if (normalized.some(isPresetMarker) || normalized.some((item) => item.reserved)) return normalized;

  const byLabel = new Map(normalized.map((item) => [item.label, item]));
  return readingVenuePreset().map((presetItem) => {
    const previous = byLabel.get(presetItem.label);
    if (!previous || !ticketAssignable.has(presetItem.objectType)) return presetItem;
    return {
      ...presetItem,
      priceMode: previous.priceMode,
      priceMinor: previous.priceMinor,
      categoryId: previous.categoryId,
      seatAssignments: assignments(presetItem.seats, previous.seatAssignments ?? [], previous.categoryId),
    };
  });
}

function Palette({ type }: { type: ObjectType }) {
  return <span className={`palette-symbol ${type.toLowerCase()}`}>{type === "ROW" ? "● ● ●" : type === "ZONE" ? "A" : type === "TEXT" ? "T" : ""}</span>;
}

function tableSeatPosition(item: MapObject, index: number): React.CSSProperties {
  const position = index + 1;
  const horizontal = item.width >= item.height;
  if (item.seats === 2) return horizontal ? { left:position === 1 ? "12%" : "88%", top:"50%" } : { left:"50%", top:position === 1 ? "12%" : "88%" };
  if (item.seats === 6 && horizontal) {
    const top = index < 3;
    return { left:`${[18, 50, 82][index % 3]}%`, top:top ? "14%" : "86%" };
  }
  if (item.seats === 8 && !horizontal) {
    const left = index < 4;
    return { left:left ? "15%" : "85%", top:`${[14, 38, 62, 86][index % 4]}%` };
  }
  const half = Math.ceil(item.seats / 2);
  const firstSide = index < half;
  const slot = firstSide ? index : index - half;
  const count = firstSide ? half : Math.floor(item.seats / 2);
  const offset = `${((slot + 1) / (count + 1)) * 100}%`;
  return horizontal ? { left:offset, top:firstSide ? "14%" : "86%" } : { left:firstSide ? "15%" : "85%", top:offset };
}

function Shape({ item, categories, mode, selectedSeats, onSeat }: { item: MapObject; categories: Category[]; mode: "design" | "tickets"; selectedSeats: Set<number>; onSeat: (position: number, shift: boolean) => void }) {
  if (item.objectType === "ZONE") {
    const category = categories.find((value) => value.id === item.categoryId);
    const zoneStyle = mode === "tickets" && category ? ({ "--zone-ticket-color":category.colorHex } as React.CSSProperties) : undefined;
    return <div className={`shape-zone ${mode === "tickets" && category ? "zone-ticket-assigned" : ""}`} style={zoneStyle}><strong>{item.label}</strong></div>;
  }
  if (item.objectType === "STAGE") return <div className="shape-stage"><strong>{item.label}</strong></div>;
  if (item.objectType === "BAR") return <div className="shape-bar"><strong>{item.label}</strong></div>;
  if (item.objectType === "TEXT") return <div className="shape-text">{item.label}</div>;

  const seat = (position: number, className: string, style?: React.CSSProperties) => <button type="button" key={position} className={`${className} ticket-seat ${selectedSeats.has(position) ? "seat-selected" : ""}`} style={{ ...style, "--ticket-color": colorFor(item, position, categories) } as React.CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (mode === "tickets" && item.priceMode === "PER_SEAT") onSeat(position, event.shiftKey); }}>{position}</button>;

  let chairs: React.ReactNode;
  if (item.objectType === "ROW") chairs = <span className="row-chairs">{Array.from({ length: item.seats }, (_, index) => seat(index + 1, "row-chair"))}</span>;
  else if (item.objectType === "SOFA") chairs = <span className="sofa-cushions">{Array.from({ length: item.seats }, (_, index) => seat(index + 1, "sofa-seat", { left:`${((index + 1) / (item.seats + 1)) * 100}%`, top:"72%" }))}</span>;
  else if (item.objectType === "ROUND_TABLE") chairs = Array.from({ length: item.seats }, (_, index) => { const angle = index / item.seats * Math.PI * 2 - Math.PI / 2; return seat(index + 1, "radial-chair", { left:`${50 + Math.cos(angle) * 39}%`, top:`${50 + Math.sin(angle) * 39}%` }); });
  else chairs = Array.from({ length: item.seats }, (_, index) => seat(index + 1, "edge-chair", tableSeatPosition(item, index)));

  const orientation = item.objectType === "TABLE" ? (item.width >= item.height ? "table-horizontal" : "table-vertical") : "";
  return <div className={`furniture furniture-${item.objectType.toLowerCase()} ${orientation} ${mode === "tickets" ? "ticket-mode" : ""}`}><div className="furniture-core"><strong>{item.label}</strong></div>{chairs}</div>;
}

export function VenueMapEditor({ eventId, categories, initialObjects, venueName }: { eventId: string; categories: Category[]; initialObjects: MapObject[]; venueName?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = copy[locale];
  const [objects, setObjects] = useState<MapObject[]>(() => prepareInitialObjects(initialObjects, venueName));
  const [mode, setMode] = useState<"design" | "tickets">("design");
  const [selectedId, setSelectedId] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set());
  const [assignmentCategory, setAssignmentCategory] = useState(categories[0]?.id ?? "");
  const [zoom, setZoom] = useState(() => isReadingVenue(venueName ?? "") ? 55 : 75);
  const [inspector, setInspector] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<MapObject[][]>([]);
  const [future, setFuture] = useState<MapObject[][]>([]);
  const drag = useRef<{ id: string; before: MapObject[] } | null>(null);
  const selected = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId]);
  const scale = zoom / 100;
  const capacity = objects.filter((item) => seatBased.has(item.objectType)).reduce((sum, item) => sum + item.seats, 0);

  function commit(next: MapObject[]) { setHistory((current) => [...current.slice(-29), objects]); setFuture([]); setObjects(next); }
  function patch(value: Partial<MapObject>) { commit(objects.map((item) => item.id === selectedId ? { ...item, ...value } : item)); }
  function choose(id: string) {
    setSelectedId(id);
    setInspector(true);
    setSelectedPositions(new Set());
    const item = objects.find((value) => value.id === id);
    if (item?.categoryId) setAssignmentCategory(item.categoryId);
  }
  function add(type: ObjectType, labelOverride?: string) {
    const number = objects.filter((item) => item.objectType === type && !isPresetMarker(item)).length + 1;
    const names: Record<ObjectType, string> = { TABLE:"T", ROUND_TABLE:"R", SOFA:"S", ROW:text.row, ZONE:text.zone, STAGE:text.stage, BAR:text.bar, TEXT:text.text };
    const base = preset[type];
    const item: MapObject = { id:`new-${crypto.randomUUID()}`, label:labelOverride ?? `${names[type]}${seatBased.has(type) ? ` ${number}` : ""}`, objectType:type, ...base, priceMinor:0, x:50, y:50, categoryId:null, reserved:false, seatAssignments:assignments(base.seats, []) };
    commit([...objects, item]); choose(item.id);
  }
  function selectSeat(position: number, shift: boolean) {
    setSelectedPositions((current) => { const next = new Set(current); if (shift && current.size) { const anchor = [...current].at(-1) ?? position; const [from, to] = [anchor, position].sort((a, b) => a - b); for (let value = from; value <= to; value += 1) next.add(value); } else if (next.has(position)) next.delete(position); else next.add(position); return next; });
  }
  function assignCategory(clear = false) {
    if (!selected || !ticketAssignable.has(selected.objectType)) return;
    const id = clear ? null : assignmentCategory;
    if (selected.objectType === "ZONE" || selected.priceMode === "WHOLE_TABLE") patch({ categoryId:id, priceMinor:categories.find((category) => category.id === id)?.priceMinor ?? 0 });
    else {
      const positions = selectedPositions.size ? selectedPositions : new Set(Array.from({ length:selected.seats }, (_, index) => index + 1));
      patch({ seatAssignments:assignments(selected.seats, selected.seatAssignments).map((seat) => positions.has(seat.position) ? { ...seat, categoryId:id } : seat) });
    }
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, { method:"PATCH", headers:{ "content-type":"application/json" }, body:JSON.stringify({ action:"layout", objects:objects.map((item) => ({ ...item, id:item.id.startsWith("new-") ? undefined : item.id, priceMinor:item.categoryId ? categories.find((category) => category.id === item.categoryId)?.priceMinor ?? 0 : 0, seatAssignments:assignments(item.seats, item.seatAssignments) })) }) });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? text.saved : result.error || text.saveError);
      if (response.ok) router.refresh();
    } catch { setMessage(text.saveError); }
    finally { setBusy(false); }
  }

  const groups: Array<[string, Array<[ObjectType, string]>]> = [
    [text.addSeats, [["ROW", text.row], ["TABLE", text.table], ["ROUND_TABLE", text.round], ["SOFA", text.sofa], ["ZONE", text.zone]]],
    [text.addObjects, [["STAGE", text.stage], ["BAR", text.bar], ["TEXT", text.text]]],
  ];

  return <section className={`venue-builder ${mapStyle.atlas}`}>
    <header className="builder-topbar"><div className="builder-title"><span className="eyebrow">Atlas venue builder</span><strong>{venueName || text.mapTitle}</strong></div><div className="builder-tabs"><button type="button" className={mode === "design" ? "active" : ""} onClick={() => { setMode("design"); setSelectedPositions(new Set()); }}>{text.design}</button><button type="button" className={mode === "tickets" ? "active" : ""} onClick={() => setMode("tickets")}>{text.tickets}</button></div><div className="builder-actions"><button type="button" className="icon-btn" disabled={!history.length} onClick={() => { const previous = history.at(-1); if (previous) { setFuture((current) => [objects, ...current]); setObjects(previous); setHistory((current) => current.slice(0, -1)); } }}>↶</button><button type="button" className="icon-btn" disabled={!future.length} onClick={() => { const next = future[0]; if (next) { setHistory((current) => [...current, objects]); setObjects(next); setFuture((current) => current.slice(1)); } }}>↷</button>{selected && <button type="button" className="btn secondary inspector-toggle" onClick={() => setInspector((current) => !current)}>{text.settings}</button>}<button type="button" className="btn" disabled={busy || !objects.length} onClick={() => void save()}>{busy ? text.saving : text.save}</button></div></header>
    <div className={`builder-body ${inspector ? "inspector-open" : ""}`}>
      <aside className="object-library">{groups.map(([title, items]) => <div className="library-group" key={title}><h3>{title}</h3>{items.map(([type, label]) => <button type="button" key={type} onClick={() => add(type)}><Palette type={type}/><span>{label}</span></button>)}</div>)}<div className="library-group custom-object-group"><h3>{text.customObjects}</h3><p className="muted">{text.customHelp}</p><button type="button" onClick={() => add("TABLE", text.customRect)}><Palette type="TABLE"/><span>{text.customRect}</span></button><button type="button" onClick={() => add("ROUND_TABLE", text.customOval)}><Palette type="ROUND_TABLE"/><span>{text.customOval}</span></button><button type="button" onClick={() => add("ROW", text.customRow)}><Palette type="ROW"/><span>{text.customRow}</span></button></div></aside>
      <main className="builder-workspace"><div className="floating-tools"><button type="button" className="tool-active">↖</button><span/><button type="button" onClick={() => setZoom((value) => Math.max(35, value - 10))}>−</button><strong>{zoom}%</strong><button type="button" onClick={() => setZoom((value) => Math.min(125, value + 10))}>＋</button></div><div className="workspace-hint">{mode === "design" ? text.designHelp : text.ticketHelp}</div>{mode === "tickets" && <div className="ticket-legend"><strong>{text.legend}</strong>{categories.map((category) => <span key={category.id}><i style={{ background:category.colorHex }}/>{category.name} · {money(category.priceMinor)}</span>)}<span><i className="unassigned"/>{text.unassigned}</span></div>}<div className="map-scroll"><div className="map-world-frame" style={{ width:WORLD_WIDTH * scale, height:WORLD_HEIGHT * scale }}><div className={`map-world ${mode}`} style={{ width:WORLD_WIDTH, height:WORLD_HEIGHT, transform:`scale(${scale})` }} onClick={() => { setSelectedId(""); setInspector(false); setSelectedPositions(new Set()); }}>{objects.filter((item) => !isPresetMarker(item)).map((item) => <div key={item.id} className={`editor-object ${selectedId === item.id ? "selected" : ""} ${item.reserved ? "locked" : ""}`} style={{ left:`${item.x}%`, top:`${item.y}%`, width:item.width, height:item.height, transform:`translate(-50%,-50%) rotate(${item.rotation}deg)`, zIndex:item.objectType === "ZONE" ? 1 : item.objectType === "STAGE" || item.objectType === "BAR" ? 2 : 3 }} onClick={(event) => { event.stopPropagation(); choose(item.id); }} onPointerDown={(event) => { if (mode !== "design" || item.reserved || event.button !== 0) return; event.stopPropagation(); drag.current = { id:item.id, before:objects }; try { event.currentTarget.setPointerCapture(event.pointerId); } catch { drag.current = null; } }} onPointerMove={(event) => { if (drag.current?.id !== item.id) return; const world = event.currentTarget.parentElement; if (!world) return; const bounds = world.getBoundingClientRect(); if (!bounds.width || !bounds.height) return; setObjects((current) => current.map((value) => value.id === item.id ? { ...value, x:clamp((event.clientX - bounds.left) / bounds.width * 100), y:clamp((event.clientY - bounds.top) / bounds.height * 100) } : value)); }} onPointerUp={(event) => { if (drag.current?.id === item.id) { setHistory((current) => [...current.slice(-29), drag.current!.before]); setFuture([]); drag.current = null; try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch {} } }} onPointerCancel={(event) => { if (drag.current?.id === item.id) drag.current = null; try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch {} }}><Shape item={item} categories={categories} mode={mode} selectedSeats={selectedId === item.id ? selectedPositions : new Set()} onSeat={selectSeat}/></div>)}</div></div></div><div className="builder-status"><span>{text.capacity}: {capacity}</span><span>{message}</span></div></main>
      {inspector && <aside className="property-panel"><button type="button" className="close-inspector" onClick={() => setInspector(false)}>×</button>{!selected ? <p className="empty-inspector">{text.selectHelp}</p> : <div className="inspector-content"><span className="eyebrow">{mode === "design" ? text.design : text.tickets}</span><h3>{selected.label}</h3>{mode === "design" ? <><label className="field"><span>{text.label}</span><input className="input" value={selected.label} onChange={(event) => patch({ label:event.target.value })}/></label>{seatBased.has(selected.objectType) && <label className="field"><span>{text.seats}</span><input className="input" type="number" min="1" max="50" value={selected.seats} onChange={(event) => { const seats = Number(event.target.value); patch({ seats, seatAssignments:assignments(seats, selected.seatAssignments) }); }}/></label>}<div className="property-pair"><label className="field"><span>{text.width}</span><input className="input" type="number" value={selected.width} onChange={(event) => patch({ width:Number(event.target.value) })}/></label><label className="field"><span>{text.height}</span><input className="input" type="number" value={selected.height} onChange={(event) => patch({ height:Number(event.target.value) })}/></label></div><div className="rotation-controls"><strong>{text.rotation}: {selected.rotation}°</strong><div><button type="button" title={text.left} onClick={() => patch({ rotation:norm(selected.rotation - 15) })}>↶ 15°</button><button type="button" title={text.right} onClick={() => patch({ rotation:norm(selected.rotation + 15) })}>↷ 15°</button></div><input type="range" min="0" max="355" step="5" value={selected.rotation} onChange={(event) => patch({ rotation:Number(event.target.value) })}/></div><button type="button" className="delete-object" onClick={() => { commit(objects.filter((item) => item.id !== selected.id)); setSelectedId(""); setInspector(false); }}>{text.remove}</button></> : ticketAssignable.has(selected.objectType) ? <>{seatBased.has(selected.objectType) && <><div className="segmented"><button type="button" className={selected.priceMode === "WHOLE_TABLE" ? "active" : ""} onClick={() => patch({ priceMode:"WHOLE_TABLE" })}>{text.whole}</button><button type="button" className={selected.priceMode === "PER_SEAT" ? "active" : ""} onClick={() => patch({ priceMode:"PER_SEAT" })}>{text.perSeat}</button></div>{selected.priceMode === "PER_SEAT" && <div className="selection-count"><span>{text.selectedSeats}</span><strong>{selectedPositions.size || selected.seats}</strong></div>}</>}<label className="field"><span>{text.ticket}</span><select value={assignmentCategory} onChange={(event) => setAssignmentCategory(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {money(category.priceMinor)}</option>)}</select></label><button type="button" className="btn assign-ticket" onClick={() => assignCategory()}>{text.assign}</button><button type="button" className="btn secondary" onClick={() => assignCategory(true)}>{text.clear}</button></> : <p className="muted">{text.unassigned}</p>}</div>}</aside>}
    </div>
  </section>;
}
