import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadEventEditor, type EventEditorState } from "@/lib/event-editor-api";

export default function EventHubScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = String(id || "");
  const [state, setState] = useState<EventEditorState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadEventEditor(eventId).then((value) => { if (mounted) setState(value); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [eventId]);

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!state) return <SafeAreaView style={s.center}><Text>Не удалось открыть мероприятие</Text></SafeAreaView>;

  const canManage = state.permissions.includes("EVENT_MANAGE");
  const canTickets = state.permissions.includes("TICKET_MANAGE");

  return <SafeAreaView style={s.safe} edges={["top"]}>
    <View style={s.header}>
      <TouchableOpacity style={s.icon} onPress={() => router.back()}><Ionicons name="chevron-back" size={27} color="#17213C" /></TouchableOpacity>
      <View style={s.headerCopy}><Text style={s.title} numberOfLines={2}>{state.event.title}</Text><Text style={s.meta}>{state.review.archived ? "ARCHIVED" : state.event.status} · {state.event.venue.name}</Text></View>
      <TouchableOpacity style={s.icon} onPress={() => Linking.openURL(`https://www.atlas-one.co/events/${state.review.slug}`)}><Ionicons name="open-outline" size={22} color="#17213C" /></TouchableOpacity>
    </View>

    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.sectionTitle}>Управление мероприятием</Text>
      <Text style={s.help}>Все рабочие разделы мероприятия доступны из одного места.</Text>

      <Action icon="receipt-outline" title="Заказы" text="Заявки, approvals, отмены, возвраты и повторная отправка билетов." onPress={() => router.push({ pathname: "/event-orders/[id]", params: { id: eventId } })} />
      <Action icon="settings-outline" title="Настройки" text="О мероприятии, билеты и цены, карта, checkout, публикация и архив." onPress={() => router.push({ pathname: "/event-editor/[id]", params: { id: eventId } })} />
      <Action icon="scan-outline" title="Сканер" text="QR-сканирование, ручной поиск и check-in посетителей." onPress={() => router.push({ pathname: "/scanner", params: { eventId, eventTitle: state.event.title } })} />

      {(canManage || canTickets) && <View style={s.advanced}>
        <Text style={s.advancedTitle}>Дополнительные настройки</Text>
        {canManage && <Mini icon="link-outline" label="Продажи и гостевые ссылки" onPress={() => router.push({ pathname: "/guest-links/[id]", params: { id: eventId } })} />}
        {canTickets && <Mini icon="ticket-outline" label="Дизайн билета" onPress={() => router.push({ pathname: "/ticket-design/[id]", params: { id: eventId } })} />}
        <Text style={s.note}>Эти разделы работают с теми же данными и backend-процессами, что и web back-office.</Text>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

function Action({ icon, title, text, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string; onPress: () => void }) {
  return <TouchableOpacity style={s.card} activeOpacity={0.82} onPress={onPress}><View style={s.cardIcon}><Ionicons name={icon} size={25} color="#6D45FF" /></View><View style={s.cardCopy}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardText}>{text}</Text></View><Ionicons name="chevron-forward" size={21} color="#9AA1B1" /></TouchableOpacity>;
}
function Mini({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return <TouchableOpacity style={s.mini} onPress={onPress}><Ionicons name={icon} size={20} color="#17213C" /><Text style={s.miniText}>{label}</Text><Ionicons name="chevron-forward" size={17} color="#8A92A3" /></TouchableOpacity>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6FA" },
  header: { minHeight: 76, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E6E8EF", paddingHorizontal: 10, flexDirection: "row", alignItems: "center" },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, paddingHorizontal: 5 }, title: { color: "#17213C", fontWeight: "900", fontSize: 18 }, meta: { color: "#7B8498", fontSize: 11.5, marginTop: 3 },
  content: { padding: 16, paddingBottom: 80 }, sectionTitle: { fontSize: 27, fontWeight: "900", color: "#17213C" }, help: { color: "#7B8498", lineHeight: 19, marginTop: 4, marginBottom: 16 },
  card: { minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: "#E1E4EC", backgroundColor: "#fff", padding: 14, marginBottom: 11, flexDirection: "row", alignItems: "center" },
  cardIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: "#EEE9FF", alignItems: "center", justifyContent: "center", marginRight: 12 }, cardCopy: { flex: 1, paddingRight: 8 }, cardTitle: { fontSize: 17, fontWeight: "900", color: "#17213C" }, cardText: { color: "#737D90", fontSize: 12, lineHeight: 17, marginTop: 4 },
  advanced: { marginTop: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E4EC", borderRadius: 18, padding: 14 }, advancedTitle: { fontSize: 16, fontWeight: "900", color: "#17213C", marginBottom: 7 },
  mini: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: "#EEF0F4", flexDirection: "row", alignItems: "center", gap: 9 }, miniText: { flex: 1, color: "#303A50", fontWeight: "800" }, note: { color: "#8A92A3", fontSize: 11.5, lineHeight: 17, marginTop: 10 },
});
