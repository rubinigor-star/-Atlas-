import { CalendarDays, Clock3, MapPin, ShieldCheck, Tags } from "lucide-react";
import { getAgeRestrictionDescription } from "@/lib/event-info-options";
import styles from "./event-facts-grid.module.css";

type Locale="ru"|"he"|"en";
type Props={locale:Locale;runtimeMinutes:number;intermissionCount:number;venue:string;address:string;city:string;categories:string[];ageRestriction:string;startDate:string};

const copy={
  ru:{runtime:"Продолжительность",venue:"Зал / площадка",categories:"Категории",age:"Возраст",startDate:"Дата мероприятия",notSet:"Не указано",hours:"ч",minutes:"мин",noIntermission:"без антракта",oneIntermission:"включая 1 антракт",manyIntermissions:"антракта"},
  he:{runtime:"משך האירוע",venue:"אולם / מקום",categories:"קטגוריות",age:"גיל",startDate:"תאריך האירוע",notSet:"לא צוין",hours:"ש׳",minutes:"דק׳",noIntermission:"ללא הפסקה",oneIntermission:"כולל הפסקה אחת",manyIntermissions:"הפסקות"},
  en:{runtime:"Run time",venue:"Venue / location",categories:"Categories",age:"Age",startDate:"Event date",notSet:"Not specified",hours:"hr",minutes:"min",noIntermission:"No intermission",oneIntermission:"Incl. 1 intermission",manyIntermissions:"intermissions"},
} as const;

function formatRuntime(minutes:number,locale:Locale){const t=copy[locale];if(!minutes)return t.notSet;const hours=Math.floor(minutes/60);const rest=minutes%60;const parts=[] as string[];if(hours)parts.push(`${hours} ${t.hours}`);if(rest)parts.push(`${rest} ${t.minutes}`);return parts.join(" ");}
function formatIntermission(count:number,locale:Locale){const t=copy[locale];if(count===0)return t.noIntermission;if(count===1)return t.oneIntermission;return `${count} ${t.manyIntermissions}`;}

export function EventFactsGrid(props:Props){
  const t=copy[props.locale];
  const destination=encodeURIComponent([props.venue,props.address,props.city,"Israel"].filter(Boolean).join(", "));
  const mapUrl=`https://www.google.com/maps/search/?api=1&query=${destination}`;
  const categories=[...new Set(props.categories.filter(Boolean))];
  return <section className={styles.grid} aria-label="Event information">
    <article className={styles.item}><CalendarDays/><div><h3>{t.startDate}</h3><p>{props.startDate}</p></div></article>
    <article className={styles.item}><MapPin/><div><h3>{t.venue}</h3><a href={mapUrl} target="_blank" rel="noreferrer">{props.venue}</a><p>{props.address}</p></div></article>
    <article className={styles.item}><Tags/><div><h3>{t.categories}</h3><p className={styles.categoryList}>{categories.length?categories.join(", "):t.notSet}</p></div></article>
    <article className={styles.item}><ShieldCheck/><div><h3>{t.age}</h3><strong>{props.ageRestriction}</strong><p>{getAgeRestrictionDescription(props.ageRestriction,props.locale)}</p></div></article>
    <article className={styles.item}><Clock3/><div><h3>{t.runtime}</h3><p>{formatRuntime(props.runtimeMinutes,props.locale)}{props.runtimeMinutes?` · ${formatIntermission(props.intermissionCount,props.locale)}`:""}</p></div></article>
  </section>;
}
