import { CalendarDays, Map, MapPin, Navigation, ShieldCheck, Theater } from "lucide-react";
import { getAgeRestrictionDescription } from "@/lib/event-info-options";
import styles from "./event-meta-strip.module.css";

type Locale = "ru" | "he" | "en";
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
  ru: { doors: "Открытие дверей", start: "Начало мероприятия", map: "Показать на карте", waze: "Маршрут в Waze", age: "Возрастное ограничение" },
  he: { doors: "פתיחת דלתות", start: "תחילת האירוע", map: "הצגה במפה", waze: "ניווט ב-Waze", age: "הגבלת גיל" },
  en: { doors: "Doors open", start: "Event starts", map: "Show on map", waze: "Navigate with Waze", age: "Age restriction" },
} as const;

export function EventMetaStrip(props: Props) {
  const t = copy[props.locale];
  const query = encodeURIComponent(props.address || `${props.venue}, ${props.city}`);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const wazeUrl = `https://www.waze.com/ul?q=${query}&navigate=yes`;
  const fullDate = new Intl.DateTimeFormat(localeCode[props.locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(props.startsAt));
  const formattedFullDate = fullDate.charAt(0).toUpperCase() + fullDate.slice(1);

  return <div className={styles.strip}>
    <div className={`${styles.item} ${styles.date}`}>
      <button type="button" className={styles.trigger}><CalendarDays size={19}/><span>{props.date}</span></button>
      <div className={`${styles.popover} ${styles.schedulePopover}`} role="tooltip">
        <div className={styles.popIcon}><CalendarDays/></div>
        <h3>{formattedFullDate}</h3>
        <div className={styles.facts}>
          {props.doorsOpenTime && <div className={styles.fact}><span>{t.doors}</span><strong>{props.doorsOpenTime}</strong></div>}
          <div className={styles.fact}><span>{t.start}</span><strong>{props.startTime}</strong></div>
        </div>
      </div>
    </div>

    <div className={`${styles.item} ${styles.city}`}>
      <div className={styles.trigger}><MapPin size={19}/><span>{props.city}</span></div>
    </div>

    <div className={`${styles.item} ${styles.venue}`}>
      <button type="button" className={styles.trigger}><Theater size={19}/><span>{props.venue}</span></button>
      <div className={`${styles.popover} ${styles.venuePopover}`} role="tooltip">
        <div className={styles.popIcon}><Theater/></div>
        <h3>{props.venue}</h3>
        <p>{props.address}</p>
        <div className={styles.actions}>
          <a href={mapUrl} target="_blank" rel="noreferrer"><Map size={16}/><span>{t.map}</span></a>
          <a href={wazeUrl} target="_blank" rel="noreferrer"><Navigation size={16}/><span>{t.waze}</span></a>
        </div>
      </div>
    </div>

    <div className={`${styles.item} ${styles.age}`}>
      <button type="button" className={styles.trigger}><ShieldCheck size={19}/><span>{props.ageRestriction}</span></button>
      <div className={`${styles.popover} ${styles.agePopover}`} role="tooltip">
        <div className={styles.popIcon}><ShieldCheck/></div>
        <strong className={styles.ageValue}>{props.ageRestriction}</strong>
        <h3>{t.age}</h3>
        <p>{getAgeRestrictionDescription(props.ageRestriction, props.locale)}</p>
      </div>
    </div>
  </div>;
}
