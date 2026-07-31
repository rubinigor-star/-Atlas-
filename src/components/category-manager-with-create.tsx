"use client";

import { NewCategoryForm } from "@/components/new-category-form";
import { CategoryManager, type ManagedCategory } from "@/components/category-manager";

export function CategoryManagerWithCreate({eventId,categories}:{eventId:string;categories:ManagedCategory[]}){
 return <div className="stack"><NewCategoryForm eventId={eventId}/><section className="panel stack"><div><span className="eyebrow">Созданные билеты</span><h2>Категории и цены</h2><p className="muted">Редактируйте, скрывайте и контролируйте остаток существующих категорий.</p></div><CategoryManager eventId={eventId} categories={categories}/></section></div>;
}
