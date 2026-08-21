"use client";

import Link from "next/link";
import { NewCategoryForm } from "@/components/new-category-form";
import { CategoryManager, type ManagedCategory } from "@/components/category-manager";

export function CategoryManagerWithCreate({eventId,categories}:{eventId:string;categories:ManagedCategory[]}){
 return <div className="stack"><NewCategoryForm eventId={eventId}/><section className="panel stack"><div><span className="eyebrow">Созданные билеты</span><h2>Категории и цены</h2><p className="muted">Настраивайте билет, скрывайте его с продажи или удаляйте прямо из строки категории.</p></div><CategoryManager eventId={eventId} categories={categories}/></section><section className="panel"><span className="eyebrow">Внешние продажи</span><h2>Билеты с других платформ</h2><p className="muted">Загрузите продажи Eventer, Bravo, Wix или другой площадки и сканируйте их тем же Atlas Scanner.</p><Link className="btn secondary" href={`/office/events/${eventId}/external-tickets`}>Открыть внешние источники</Link></section></div>;
}
