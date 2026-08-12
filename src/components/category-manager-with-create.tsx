"use client";

import { NewCategoryForm } from "@/components/new-category-form";
import { CategoryManager, type ManagedCategory } from "@/components/category-manager";

export function CategoryManagerWithCreate({eventId,categories}:{eventId:string;categories:ManagedCategory[]}){
 return <div className="stack"><NewCategoryForm eventId={eventId}/><section className="panel stack"><div><span className="eyebrow">Созданные билеты</span><h2>Категории и цены</h2><p className="muted">Настраивайте билет, скрывайте его с продажи или удаляйте прямо из строки категории.</p></div><CategoryManager eventId={eventId} categories={categories}/></section></div>;
}
