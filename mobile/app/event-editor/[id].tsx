import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadEventEditor, type EventEditorState } from "@/lib/event-editor-api";
import { AboutTab } from "@/components/editor/AboutTab";
import { TicketsTab } from "@/components/editor/TicketsTab";
import { MapTab } from "@/components/editor/MapTab";
import { CheckoutTab } from "@/components/editor/CheckoutTab";
import { ReviewTab } from "@/components/editor/ReviewTab";
import { AdvancedTab } from "@/components/editor/AdvancedTab";

const tabs = [
  { id: "about", label: "О мероприятии" },
  { id: "tickets", label: "Билеты и цены" },
  { id: "map", label: "Места и карта" },
  { id: "checkout", label: "Покупатель" },
  { id: "review", label: "Проверка" },
  { id: "advanced", label: "Дополнительно" },
] as const;
type TabId = (typeof tabs)[number]["id"];

export default function EventEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const eventId = String(params.id || "");
  const [active, setActive] = useState<TabId>("about");
  const [state, setState] = useState<EventEditorState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await loadEventEditor(eventId);
        if (mounted) setState(payload);
      } catch (error) {
        if (mounted) Alert.alert("Не удалось открыть мероприятие", error instanceof Error ? error.message : "Ошибка");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [eventId]);

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!state) return <SafeAreaView style={s.center}><Text>Мероприятие не найдено</Text></SafeAreaView>;

  return <SafeAreaView style={s.safe} edges={["top"]}>
    <View style={s.header}>
      <TouchableOpacity onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={28} color="#17213C" /></TouchableOpacity>
      <View style={s.headerCenter}><Text numberOfLines={1} style={s.headerTitle}>{state.event.title}</Text><Text style={s.headerMeta}>{state.review.archived ? "ARCHIVED" : state.event.status}</Text></View>
      <TouchableOpacity style={s.icon} onPress={() => setActive("advanced")}><Ionicons name="ellipsis-horizontal" size={25} color="#17213C" /></TouchableOpacity>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={s.tabsContent} keyboardShouldPersistTaps="handled">
      {tabs.map((tab, index) => <TouchableOpacity key={tab.id} style={[s.tab, active === tab.id && s.tabOn]} onPress={() => setActive(tab.id)}><Text style={[s.tabIndex, active === tab.id && s.tabIndexOn]}>{String(index + 1).padStart(2, "0")}</Text><Text style={[s.tabLabel, active === tab.id && s.tabLabelOn]}>{tab.label}</Text></TouchableOpacity>)}
    </ScrollView>
    <View style={s.body}>
      {active === "about" && <AboutTab eventId={eventId} state={state} onState={setState} />}
      {active === "tickets" && <TicketsTab eventId={eventId} state={state} onState={setState} />}
      {active === "map" && <MapTab eventId={eventId} state={state} onState={setState} />}
      {active === "checkout" && <CheckoutTab eventId={eventId} state={state} onState={setState} />}
      {active === "review" && <ReviewTab eventId={eventId} state={state} onState={setState} />}
      {active === "advanced" && <AdvancedTab eventId={eventId} state={state} />}
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6FA" },
  header: { height: 70, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E6E8EF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { maxWidth: "90%", fontWeight: "900", color: "#17213C", fontSize: 19 },
  headerMeta: { color: "#7D8596", fontSize: 11, marginTop: 2 },
  tabs: { maxHeight: 84, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E6E8EF" },
  tabsContent: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  tab: { minWidth: 124, height: 58, borderRadius: 15, paddingHorizontal: 13, justifyContent: "center", backgroundColor: "#F2F3F7" },
  tabOn: { backgroundColor: "#EEE9FF" },
  tabIndex: { fontSize: 10, fontWeight: "900", color: "#9AA1B1" },
  tabIndexOn: { color: "#6D45FF" },
  tabLabel: { fontSize: 13, fontWeight: "800", color: "#647086", marginTop: 2 },
  tabLabelOn: { color: "#5134DC" },
  body: { flex: 1 },
});
