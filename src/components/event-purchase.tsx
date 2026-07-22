"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

type Category = { id: string; name: string; description: string | null; priceMinor: number; capacity: number; sold: number };
type MapSeat = { id: string; label: string; position: number; status: "AVAILABLE" | "RESERVED" | "BLOCKED" };
type MapObject = {
  id: string;
  label: string;
  seats: number;
  priceMinor: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  reserved: boolean;
  categoryId: string | null;
  category: { name: string } | null;
  zone: { name: string };
  seatItems: MapSeat[];
};

const copy = {
  ru: { title: "Выберите билет", remaining: "осталось", map: "Выберите место на карте", stage: "СЦЕНА", whole: "целиком", perSeat: "за место", selected: "Выбрано мест", quantity: "Количество", total: "Итого", continue: "Продолжить", table: "стол", sofa: "диван", unavailable: "Занято" },
  he: { title: "בחירת כרטיס", remaining: "נותרו", map: "בחירת מקום במפה", stage: "במה", whole: "מחיר מלא", perSeat: "למקום", selected: "מקומות שנבחרו", quantity: "כמות", total: "סה״כ", continue: "המשך", table: "שולחן", sofa: "ספה", unavailable: "תפוס" },
};

export function EventPurchase({ eventId, categories, objects }: { eventId: string; categories: Category[]; objects: MapObject[] }) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = copy[locale];
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [wholeObjectId, setWholeObjectId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const category = categories.find((item) => item.id === categoryId);
  const wholeObject = objects.find((item) => item.id === wholeObjectId);
  const seatObject = objects.find((item) => item.seatItems.some((seat) => selectedSeatIds.includes(seat.id)));
  const selectionObject = wholeObject ?? seatObject;
  const total = useMemo(() => {
    if (wholeObject) return wholeObject.priceMinor;
    if (seatObject) return seatObject.priceMinor * selectedSeatIds.length;
    return (category?.priceMinor ?? 0) * qty;
  }, [wholeObject, seatObject, selectedSeatIds.length, category, qty]);

  function clearMapSelection() {
    setWholeObjectId(null);
    setSelectedSeatIds([]);
  }

  function chooseSeat(object: MapObject, seat: MapSeat) {
    if (seat.status !== "AVAILABLE") return;
    setWholeObjectId(null);
    setCategoryId(object.categoryId ?? categoryId);
    setSelectedSeatIds((current) => {
      const belongsToSameObject = current.every((id) => object.seatItems.some((item) => item.id === id));
      const base = belongsToSameObject ? current : [];
      return base.includes(seat.id) ? base.filter((id) => id !== seat.id) : [...base, seat.id];
    });
  }

  function go() {
    if (!categoryId || (seatObject && selectedSeatIds.length === 0)) return;
    const quantity = wholeObject ? wholeObject.seats : seatObject ? selectedSeatIds.length : qty;
    const query = new URLSearchParams({ eventId, categoryId, quantity: String(quantity) });
    if (wholeObject) query.set("tableId", wholeObject.id);
    if (selectedSeatIds.length > 0) query.set("seatIds", selectedSeatIds.join(","));
    router.push(`/checkout?${query}`);
  }

  return <div className="panel purchase-panel">
    <h2>{text.title}</h2>
    <div className="options">{categories.map((item) => <button type="button" key={item.id} className={`option ${categoryId === item.id && !selectionObject ? "selected" : ""}`} onClick={() => { setCategoryId(item.id); clearMapSelection(); }}><span><strong>{item.name}</strong><br /><small className="muted">{item.description} · {text.remaining} {item.capacity - item.sold}</small></span><strong>{money(item.priceMinor)}</strong></button>)}</div>

    {objects.length > 0 && <>
      <h3 className="map-purchase-title">{text.map}</h3>
      <div className="venue-canvas buyer-map">
        <div className="map-stage">{text.stage}</div>
        {objects.map((object) => {
          const isSellable = ["TABLE", "ROUND_TABLE", "SOFA", "ROW"].includes(object.objectType);
          const soldWhole = object.reserved;
          const selectedWhole = wholeObjectId === object.id;
          return <div
            key={object.id}
            className={`map-object buyer-object object-${object.objectType.toLowerCase().replace("_", "-")} ${object.objectType.toLowerCase().replace("_", "-")} ${selectedWhole ? "selected" : ""} ${soldWhole ? "unavailable" : ""}`}
            style={{ left: `${object.x}%`, top: `${object.y}%`, width: object.width, height: object.height, transform: `translate(-50%, -50%) rotate(${object.rotation}deg)`, zIndex: object.objectType === "ZONE" ? 1 : 2 }}
          >
            {!isSellable ? <div className={`buyer-decoration decoration-${object.objectType.toLowerCase()}`}><strong>{object.label}</strong></div> : <>
            <button
              type="button"
              className="object-core"
              disabled={soldWhole || object.priceMode === "PER_SEAT"}
              onClick={() => {
                setSelectedSeatIds([]);
                setWholeObjectId(selectedWhole ? null : object.id);
                setCategoryId(object.categoryId ?? categoryId);
              }}
            >
              <strong>{object.label}</strong>
              <small>{object.objectType === "SOFA" ? text.sofa : object.objectType === "ROW" ? "row" : text.table}</small>
            </button>
            <span className="buyer-seat-ring">
              {object.seatItems.map((seat) => <button
                type="button"
                key={seat.id}
                title={seat.status === "AVAILABLE" ? seat.label : text.unavailable}
                disabled={object.priceMode === "WHOLE_TABLE" || seat.status !== "AVAILABLE"}
                className={`map-seat ${selectedSeatIds.includes(seat.id) ? "selected" : ""} ${seat.status.toLowerCase()}`}
                onClick={() => chooseSeat(object, seat)}
              >{seat.position}</button>)}
            </span>
            <small className="object-price">{money(object.priceMinor)} {object.priceMode === "WHOLE_TABLE" ? text.whole : text.perSeat}</small>
            </>}
          </div>;
        })}
      </div>
      {selectedSeatIds.length > 0 && <div className="seat-selection-summary"><span>{text.selected}</span><strong>{selectedSeatIds.length}</strong></div>}
    </>}

    {!selectionObject && <div className="field" style={{ marginTop: 16 }}><label>{text.quantity}</label><select value={qty} onChange={(event) => setQty(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((number) => <option key={number}>{number}</option>)}</select></div>}
    <div className="row between" style={{ marginTop: 20 }}><div><small className="muted">{text.total}</small><br /><strong style={{ fontSize: 24 }}>{money(total)}</strong></div><button className="btn" disabled={Boolean(seatObject) && selectedSeatIds.length === 0} onClick={go}>{text.continue}</button></div>
  </div>;
}
