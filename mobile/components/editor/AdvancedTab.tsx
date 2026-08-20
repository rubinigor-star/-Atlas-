import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { EventEditorState } from "@/lib/event-editor-api";

type Props = { eventId: string; state: EventEditorState };

export function AdvancedTab({ eventId, state }: Props) {
  const router = useRouter();
  const canManage = state.permissions.includes("EVENT_MANAGE");
  const canTickets = state.permissions.includes("TICKET_MANAGE");

  return <ScrollView contentContainerStyle={s.content}>
    <View style={s.head}>
      <Text style={s.eyebrow}>РАСШИРЕННОЕ УПРАВЛЕНИЕ</Text>
      <Text style={s.title}>Дополнительно</Text>
      <Text style={s.help}>Рабочие инструменты, которые относятся к этому мероприятию и используют те же данные, что и back-office.</Text>
    </View>

    <Section title="Продажи и гости">
      <Action icon="receipt-outline" title="Заказы" text="Ожидают, подтверждены, отменены, брошенные, возвраты и повторная отправка билетов." onPress={() => router.push({ pathname: "/event-orders/[id]", params: { id: eventId } })} />
      {canManage && <Action icon="link-outline" title="Гостевые ссылки" text="Создание, лимиты, цена, категория, стол или выбранные места, включение и отключение ссылок." onPress={() => router.push({ pathname: "/guest-links/[id]", params: { id: eventId } })} />}
    </Section>

    <Section title="Билеты и вход">
      {canTickets && <Action icon="ticket-outline" title="Дизайн билета" text="Шаблон билета, тексты, цвета и элементы. Сохраняется в тот же TicketTemplate." onPress={() => router.push({ pathname: "/ticket-design/[id]", params: { id: eventId } })} />}
      <Action icon="scan-outline" title="Сканер" text="QR, ручной поиск посетителя, история сканирований и check-in." onPress={() => router.push({ pathname: "/scanner", params: { eventId, eventTitle: state.event.title } })} />
    </Section>

    <View style={s.summary}>
      <Text style={s.summaryTitle}>Статус мероприятия</Text>
      <Row label="Публикация" value={state.review.status} />
      <Row label="Архив" value={state.review.archived ? "Да" : "Нет"} />
      <Row label="Категорий" value={String(state.review.categoryCount)} />
      <Row label="Продано" value={`${state.review.sold} / ${state.review.capacity}`} />
      <Row label="Карта" value={state.review.mapEnabled ? "Включена" : "Выключена"} />
    </View>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>;
}
function Action({ icon, title, text, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string; onPress: () => void }) {
  return <TouchableOpacity style={s.card} activeOpacity={0.82} onPress={onPress}>
    <View style={s.icon}><Ionicons name={icon} size={23} color="#6D45FF" /></View>
    <View style={s.copy}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardText}>{text}</Text></View>
    <Ionicons name="chevron-forward" size={20} color="#9AA1B1" />
  </TouchableOpacity>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><Text style={s.rowValue}>{value}</Text></View>;
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 80 },
  head: { marginBottom: 16 }, eyebrow: { fontSize: 10, fontWeight: "900", color: "#6D45FF", letterSpacing: 1 }, title: { fontSize: 26, fontWeight: "900", color: "#17213C", marginTop: 4 }, help: { color: "#788196", lineHeight: 19, marginTop: 5 },
  section: { marginBottom: 18 }, sectionTitle: { fontSize: 15, fontWeight: "900", color: "#17213C", marginBottom: 8 },
  card: { minHeight: 82, borderRadius: 17, borderWidth: 1, borderColor: "#E1E4EC", backgroundColor: "#fff", padding: 13, marginBottom: 9, flexDirection: "row", alignItems: "center" },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#EEE9FF", alignItems: "center", justifyContent: "center", marginRight: 11 }, copy: { flex: 1, paddingRight: 8 }, cardTitle: { color: "#17213C", fontSize: 16, fontWeight: "900" }, cardText: { color: "#737D90", fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  summary: { borderRadius: 17, borderWidth: 1, borderColor: "#E1E4EC", backgroundColor: "#fff", padding: 14 }, summaryTitle: { color: "#17213C", fontWeight: "900", fontSize: 15, marginBottom: 5 }, row: { minHeight: 38, borderBottomWidth: 1, borderBottomColor: "#EEF0F4", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, rowLabel: { color: "#7B8498" }, rowValue: { color: "#17213C", fontWeight: "800" },
});
