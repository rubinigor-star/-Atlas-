"use client";

import Link from "next/link";
import { NewCategoryForm } from "@/components/new-category-form";
import { CategoryManager, type ManagedCategory } from "@/components/category-manager";
import { useLocale } from "@/components/locale-provider";

const copy={
 ru:{eyebrow:"Созданные билеты",title:"Категории и цены",help:"Настраивайте билет, скрывайте его с продажи или удаляйте прямо из строки категории.",externalEyebrow:"Внешние продажи",externalTitle:"Билеты с других платформ",externalHelp:"Загрузите продажи Eventer, Bravo, Wix или другой площадки и сканируйте их тем же Atlas Scanner.",externalButton:"Открыть внешние источники"},
 he:{eyebrow:"כרטיסים שנוצרו",title:"קטגוריות ומחירים",help:"ערכו כרטיס, הסתירו אותו מהמכירה או מחקו אותו ישירות משורת הקטגוריה.",externalEyebrow:"מכירות חיצוניות",externalTitle:"כרטיסים מפלטפורמות אחרות",externalHelp:"ייבאו מכירות מ־Eventer, Bravo, Wix או מערכת אחרת וסרקו את כולן באותו Atlas Scanner.",externalButton:"פתיחת מקורות חיצוניים"},
 en:{eyebrow:"Created tickets",title:"Categories and pricing",help:"Configure a ticket, hide it from sale, or delete it directly from the category row.",externalEyebrow:"External sales",externalTitle:"Tickets from other platforms",externalHelp:"Import sales from Eventer, Bravo, Wix, or another platform and scan them with the same Atlas Scanner.",externalButton:"Open external sources"}
} as const;

export function CategoryManagerWithCreate({eventId,categories}:{eventId:string;categories:ManagedCategory[]}){
 const{locale}=useLocale();const text=copy[locale];
 return <div className="stack"><NewCategoryForm eventId={eventId}/><section className="panel stack"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p className="muted">{text.help}</p></div><CategoryManager eventId={eventId} categories={categories}/></section><section className="panel"><span className="eyebrow">{text.externalEyebrow}</span><h2>{text.externalTitle}</h2><p className="muted">{text.externalHelp}</p><Link className="btn secondary" href={`/office/events/${eventId}/external-tickets`}>{text.externalButton}</Link></section></div>;
}
