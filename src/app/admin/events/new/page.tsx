import {AdminShell} from "@/components/admin-shell"; import {CreateEventForm} from "@/components/create-event-form";
export default function NewEvent(){return <AdminShell><span className="eyebrow">Events</span><h1>Новое мероприятие</h1><p className="muted">MVP создаёт опубликованное событие и первую категорию. Дополнительные зоны добавляются на следующем этапе.</p><CreateEventForm/></AdminShell>}
