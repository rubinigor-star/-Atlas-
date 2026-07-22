import { AdminShell } from "@/components/admin-shell";
import { CreateEventForm } from "@/components/create-event-form";
import { requirePermission } from "@/lib/auth";

export default async function NewEvent() {
  await requirePermission("EVENT_MANAGE");
  return <AdminShell><span className="eyebrow">Events</span><h1>Новое мероприятие</h1><p className="muted">Создайте черновик, выберите формат продажи и настройте первый тариф. Публикация станет доступна после проверки.</p><CreateEventForm /></AdminShell>;
}
