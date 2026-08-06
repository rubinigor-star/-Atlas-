import { CalendarDays, Clock3, Map, MapPin, Navigation, ShieldCheck, Theater } from "lucide-react";
import { getAgeRestrictionDescription } from "@/lib/event-info-options";
import styles from "./event-meta-strip.module.css";

type Locale="ru"|"he"|"en";
type Props={locale:Locale;date:string;day:string;startTime:string;doorsOpenTime:string;city:string;venue:string;address:string;ageRestriction:string};
const copy={
 ru:{date:"Дата и время",dateHint:"Полная информация о расписании",day:"День",doors:"Открытие дверей",start:"Начало мероприятия",city:"Город",venue:"Площадка",address:"Адрес",map:"Показать на карте",waze:"Маршрут в Waze",age:"Возрастное ограничение"},
 he:{date:"תאריך ושעה",dateHint:"פרטי לוח הזמנים המלאים",day:"יום",doors:"פתיחת דלתות",start:"תחילת האירוע",city:"עיר",venue:"מקום האירוע",address:"כתובת",map:"הצגה במפה",waze:"ניווט ב-Waze",age:"הגבלת גיל"},
 en:{date:"Date and time",dateHint:"Complete schedule information",day:"Day",doors:"Doors open",start:"Event starts",city:"City",venue:"Venue",address:"Address",map:"Show on map",waze:"Navigate with Waze",age:"Age restriction"},
} as const;
export function EventMetaStrip(props:Props){
 const t=copy[props.locale]; const query=encodeURIComponent(props.address||`${props.venue}, ${props.city}`); const mapUrl=`https://www.google.com/maps/search/?api=1&query=${query}`; const wazeUrl=`https://www.waze.com/ul?q=${query}&navigate=yes`;
 return <div className={styles.strip}>
  <div className={`${styles.item} ${styles.date}`}><button type="button" className={styles.trigger}><CalendarDays size={19}/><span>{props.date}</span></button><div className={styles.popover} role="tooltip"><div className={styles.popIcon}><CalendarDays/></div><h3>{t.date}</h3><p>{t.dateHint}</p><div className={styles.facts}><div className={styles.fact}><span>{t.day}</span><strong>{props.day}</strong></div>{props.doorsOpenTime&&<div className={styles.fact}><span>{t.doors}</span><strong>{props.doorsOpenTime}</strong></div>}<div className={styles.fact}><span>{t.start}</span><strong>{props.startTime}</strong></div></div></div></div>
  <div className={`${styles.item} ${styles.city}`}><button type="button" className={styles.trigger}><MapPin size={19}/><span>{props.city}</span></button><div className={styles.popover} role="tooltip"><div className={styles.popIcon}><MapPin/></div><h3>{t.city}</h3><p>{props.city}</p></div></div>
  <div className={`${styles.item} ${styles.venue}`}><button type="button" className={styles.trigger}><Theater size={19}/><span>{props.venue}</span></button><div className={styles.popover} role="tooltip"><div className={styles.popIcon}><Theater/></div><h3>{props.venue}</h3><p>{props.address}</p><div className={styles.actions}><a href={mapUrl} target="_blank" rel="noreferrer"><Map size={15}/>{t.map}</a><a href={wazeUrl} target="_blank" rel="noreferrer"><Navigation size={15}/>{t.waze}</a></div></div></div>
  <div className={`${styles.item} ${styles.age}`}><button type="button" className={styles.trigger}><ShieldCheck size={19}/><span>{props.ageRestriction}</span></button><div className={styles.popover} role="tooltip"><div className={styles.popIcon}><ShieldCheck/></div><h3>{t.age}: {props.ageRestriction}</h3><p>{getAgeRestrictionDescription(props.ageRestriction,props.locale)}</p></div></div>
 </div>;
}
