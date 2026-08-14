import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboard, getEventEditor, type DashboardPayload } from "@/lib/api";
import { cloneEventMobile } from "@/lib/clone-api";

function day(iso: string) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); }
function time(iso: string) { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d); }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); }
function iso(date: string, value: string) { return new Date(`${date}T${value}:00+03:00`).toISOString(); }

export default function CloneEventScreen() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [doorsTime, setDoorsTime] = useState("");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesStartTime, setSalesStartTime] = useState("09:00");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [salesEndTime, setSalesEndTime] = useState("23:00");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getDashboard();
        setDashboard(d);
        const first = d.events[0];
        if (first) setSourceId(first.id);
      } catch (e) { Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось загрузить мероприятия"); }
      finally { setLoading(false); }
    })();
  }, []);

  const source = useMemo(() => dashboard?.events.find((e) => e.id === sourceId) || null, [dashboard, sourceId]);

  useEffect(() => {
    if (!sourceId || !source) return;
    (async () => {
      try {
        const payload = await getEventEditor(sourceId);
        const s = payload.event;
        const sourceStart = new Date(s.startsAt);
        const nextStart = new Date(sourceStart.getTime() + 7 * 86400000);
        const nextIso = nextStart.toISOString();
        const nextDay = day(nextIso);
        const nextTime = time(nextIso);
        setTitle(`${s.title} - копия`);
        setSlug(slugify(`${s.title}-${nextDay}`));
        setDate(nextDay);
        setStartTime(nextTime);
        const [h, m] = nextTime.split(":").map(Number);
        const doorsMinutes = h * 60 + m - 60;
        setDoorsTime(`${String(Math.floor((doorsMinutes + 1440) % 1440 / 60)).padStart(2, "0")}:${String((doorsMinutes + 1440) % 60).padStart(2, "0")}`);
        setSalesStartDate(day(new Date().toISOString()));
        setSalesEndDate(nextDay);
        setVenueName(s.venue.name);
        setCity(s.venue.city);
        setAddress(s.venue.address);
      } catch (e) { Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось загрузить исходное мероприятие"); }
    })();
  }, [sourceId]);

  async function submit() {
    if (!sourceId) return Alert.alert("Выберите мероприятие");
    if (title.trim().length < 3 || !slug.trim()) return Alert.alert("Проверьте название и slug");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(doorsTime)) return Alert.alert("Проверьте дату и время");
    setBusy(true);
    try {
      const result = await cloneEventMobile({
        sourceEventId: sourceId,
        title: title.trim(), slug: slugify(slug), startsAt: iso(date, startTime), doorsOpenAt: iso(date, doorsTime),
        salesStart: iso(salesStartDate, salesStartTime), salesEnd: iso(salesEndDate, salesEndTime),
        venueName: venueName.trim(), city: city.trim(), address: address.trim(),
        copyGuestLists: true, copyPromoters: true, copyPromoCodes: true, copyReferralLinks: true,
      });
      Alert.alert("Копия создана", "Новое мероприятие создано как DRAFT. Заказы, оплаты, билеты и сканирования не переносились.", [
        { text: "Открыть редактор", onPress: () => router.replace({ pathname: "/event-editor/[id]", params: { id: result.id } }) },
      ]);
    } catch (e) { Alert.alert("Не удалось скопировать", e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" /></SafeAreaView>;
  return <SafeAreaView style={s.safe} edges={["top"]}>
    <View style={s.header}><TouchableOpacity style={s.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color="#17213C" /></TouchableOpacity><Text style={s.headerTitle}>Скопировать мероприятие</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.help}>Копируются настройки, билеты и цены, карта, форма покупателя, дизайн билета, промокоды, рефералы и ссылки. Заказы, оплаты, проданные билеты, резервы, check-in и сканирования не копируются.</Text>
      <Text style={s.label}>Исходное мероприятие</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sourceRow}>{dashboard?.events.map((e) => <TouchableOpacity key={e.id} onPress={() => setSourceId(e.id)} style={[s.sourceCard, sourceId === e.id && s.sourceOn]}><Text numberOfLines={2} style={s.sourceTitle}>{e.title}</Text><Text style={s.sourceMeta}>{day(e.startsAt)} · {e.venue.city}</Text></TouchableOpacity>)}</ScrollView>
      <Field label="Новое название"><TextInput style={s.input} value={title} onChangeText={(v) => { setTitle(v); setSlug(slugify(v)); }} /></Field>
      <Field label="Адрес страницы"><TextInput style={s.input} value={slug} autoCapitalize="none" onChangeText={setSlug} /></Field>
      <View style={s.row}><View style={s.half}><Field label="Дата"><TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></Field></View><View style={s.half}><Field label="Начало"><TextInput style={s.input} value={startTime} onChangeText={setStartTime} placeholder="HH:MM" /></Field></View></View>
      <Field label="Открытие дверей"><TextInput style={s.input} value={doorsTime} onChangeText={setDoorsTime} placeholder="HH:MM" /></Field>
      <View style={s.row}><View style={s.half}><Field label="Продажи с"><TextInput style={s.input} value={salesStartDate} onChangeText={setSalesStartDate} placeholder="YYYY-MM-DD" /></Field></View><View style={s.half}><Field label="Время"><TextInput style={s.input} value={salesStartTime} onChangeText={setSalesStartTime} placeholder="HH:MM" /></Field></View></View>
      <View style={s.row}><View style={s.half}><Field label="Продажи до"><TextInput style={s.input} value={salesEndDate} onChangeText={setSalesEndDate} placeholder="YYYY-MM-DD" /></Field></View><View style={s.half}><Field label="Время"><TextInput style={s.input} value={salesEndTime} onChangeText={setSalesEndTime} placeholder="HH:MM" /></Field></View></View>
      <Field label="Площадка"><TextInput style={s.input} value={venueName} onChangeText={setVenueName} /></Field><Field label="Город"><TextInput style={s.input} value={city} onChangeText={setCity} /></Field><Field label="Адрес"><TextInput style={s.input} value={address} onChangeText={setAddress} /></Field>
      <TouchableOpacity disabled={busy} style={s.primary} onPress={submit}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Создать копию</Text>}</TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={{ marginBottom: 12 }}><Text style={s.label}>{label}</Text>{children}</View>; }
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F5F6FA" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, header: { height: 64, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E5E8EF", paddingHorizontal: 10 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "900", color: "#17213C" }, content: { padding: 18, paddingBottom: 80 }, help: { color: "#687287", lineHeight: 20, marginBottom: 18 }, label: { fontSize: 12, fontWeight: "800", color: "#5C667B", marginBottom: 6 }, input: { minHeight: 48, borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12, color: "#17213C" }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, sourceRow: { gap: 10, paddingBottom: 14 }, sourceCard: { width: 170, minHeight: 78, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#DFE3EB", padding: 12 }, sourceOn: { borderWidth: 2, borderColor: "#6D45FF", backgroundColor: "#F3EFFF" }, sourceTitle: { fontWeight: "900", color: "#17213C" }, sourceMeta: { color: "#7A8395", fontSize: 11, marginTop: 5 }, primary: { minHeight: 54, borderRadius: 15, backgroundColor: "#6D45FF", alignItems: "center", justifyContent: "center", marginTop: 8 }, primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 } });
