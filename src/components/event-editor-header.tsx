"use client";

import { useLocale } from "@/components/locale-provider";

const copy={
 ru:{eyebrow:"Единый редактор мероприятия",description:"Каждая настройка находится только в одном разделе."},
 he:{eyebrow:"עורך אירוע מאוחד",description:"כל הגדרה נמצאת במקום אחד בלבד."},
 en:{eyebrow:"Unified event editor",description:"Each setting appears in one section only."}
} as const;

export function EventEditorHeader({title,status}:{title:string;status:string}){
 const{locale}=useLocale();const text=copy[locale];
 return <div className="row between"><div><span className="eyebrow">{text.eyebrow}</span><h1>{title}</h1><p className="muted">{text.description}</p></div><span className="pill">{status}</span></div>;
}
