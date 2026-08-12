"use client";

import { NewCategoryForm } from "@/components/new-category-form";
import { CategoryManager, type ManagedCategory } from "@/components/category-manager";
import { CategoryDeleteManager } from "@/components/category-delete-manager";

export function CategoryManagerWithCreate({eventId,categories}:{eventId:string;categories:ManagedCategory[]}){
 return <div className="stack"><NewCategoryForm eventId={eventId}/><section className="panel stack"><div><span className="eyebrow">Созданные билеты</span><h2>Категории и цены</h2><p className="muted">Редактируйте билет, скрывайте его с продажи кнопкой «Скрыть» и контролируйте остаток. Скрытый билет остаётся в истории, но покупатели его не видят.</p></div><CategoryManager eventId={eventId} categories={categories}/></section><CategoryDeleteManager eventId={eventId} categories={categories.map(category=>({id:category.id,name:category.name,sold:category.sold,hidden:category.hidden}))}/></div>;
}
