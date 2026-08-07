"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Map, MapPin, Navigation, ShieldCheck, Theater } from "lucide-react";
import { getAgeRestrictionDescription } from "@/lib/event-info-options";
import styles from "./event-meta-strip.module.css";

type Locale = "ru" | "he" | "en";
type OpenCard = "date" | "venue" | "age" | null;
type Props = {
  locale: Locale;
  startsAt: string;
  date: string;
  startTime: string;
  doorsOpenTime: string;
  city: string;
  venue: string;
  address: string;
  ageRestriction: string;
};

const localeCode: Record<Locale, string> = { ru: "ru-IL", he: "he-IL", en: "en-IL" };
const copy = {
  ru: { doors: "Открытие дверей", start: "Начало мероприятия", map: "Показать на карте", waze: "Маршрут в Waze", age: "Возрастное ограничение", notSet: "Не указано" },
  he: { doors: "פתיחת דלתות", start: "תחילת האירוע", map: "הצגה במפה", waze: "ניווט ב-Waze", age: "הגבלת גיל", notSet: "לא צוין" },
  en: { doors: "Doors open", start: "Event starts", map: "Show on map", waze: "Navigate with Waze", age: "Age restriction", notSet: "Not specified" },
} as const;

function buildVenueDestination(venue: string, address: string, city: string) {
  const parts = [venue, address, city, "Israel"]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index);
  return parts.join(", ");
}

export function EventMetaStrip(props: Props) {
  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const t = copy[props.locale];
  const exactDestination = buildVenueDestination(props.venue, props.address, props.city);
  const encodedDestination = encodeURIComponent(exactDestination);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`;
  const wazeUrl = `https://www.waze.com/ul?q=${encodedDestination}&navigate=yes`;
  const fullDate = new Intl.DateTimeFormat(localeCode[props.locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(props.startsAt));
  const normalizedFullDate = props.locale === "ru" ? fullDate.replace(/\s*г\.?$/i, "") : fullDate;
  const formattedFullDate = normalizedFullDate.charAt(0).toUpperCase() + normalizedFullDate.slice(1);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (stripRef.current && !stripRef.current.contains(event.target as Node)) setOpenCard(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenCard(null);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function toggle(card: Exclude<OpenCard, null>) {
    setOpenCard((current) => current === card ? null : card);
  }

  return <div ref={stripRef} className={styles.strip}>
    <div className={`${styles.item} ${styles.date} ${openCard === "date" ? styles.open : ""}`}>
      <button type="button" className={styles.trigger} aria-expanded={openCard === "date"} onClick={() => toggle("date")}>
        <CalendarDays size={19}/><span>{props.date}</span>
      </button>
      <div className={`${styles.popover} ${styles.schedulePopover}`} role="dialog" aria-label={formattedFullDate}>
        <div className={styles.popIcon}><CalendarDays/></div>
        <h3>{formattedFullDate}</h3>
        <div className={styles.facts}>
          <div className={styles.fact}><span>{t.doors}</span><strong>{props.doorsOpenTime || t.notSet}</strong></div>
          <div className={styles.fact}><span>{t.start}</span><strong>{props.startTime}</strong></div>
        </div>
      </div>
    </div>

    <div className={`${styles.item} ${styles.city}`}>
      <div className={styles.trigger}><MapPin size={19}/><span>{props.city}</span></div>
    </div>

    <div className={`${styles.item} ${styles.venue} ${openCard === "venue" ? styles.open : ""}`}>
      <button type="button" className={styles.trigger} aria-expanded={openCard === "venue"} onClick={() => toggle("venue")}>
        <Theater size={19}/><span>{props.venue}</span>
      </button>
      <div className={`${styles.popover} ${styles.venuePopover}`} role="dialog" aria-label={props.venue}>
        <div className={styles.popIcon}><Theater/></div>
        <h3>{props.venue}</h3>
        <p>{props.address}</p>
        <div className={styles.actions}>
          <a href={mapUrl} target="_blank" rel="noreferrer" aria-label={`${t.map}: ${exactDestination}`}><Map size={16}/><span>{t.map}</span></a>
          <a href={wazeUrl} target="_blank" rel="noreferrer" aria-label={`${t.waze}: ${exactDestination}`}><Navigation size={16}/><span>{t.waze}</span></a>
        </div>
      </div>
    </div>

    <div className={`${styles.item} ${styles.age} ${openCard === "age" ? styles.open : ""}`}>
      <button type="button" className={styles.trigger} aria-expanded={openCard === "age"} onClick={() => toggle("age")}>
        <ShieldCheck size={19}/><span>{props.ageRestriction}</span>
      </button>
      <div className={`${styles.popover} ${styles.agePopover}`} role="dialog" aria-label={`${t.age}: ${props.ageRestriction}`}>
        <div className={styles.popIcon}><ShieldCheck/></div>
        <strong className={styles.ageValue}>{props.ageRestriction}</strong>
        <h3>{t.age}</h3>
        <p>{getAgeRestrictionDescription(props.ageRestriction, props.locale)}</p>
      </div>
    </div>
  </div>;
}
