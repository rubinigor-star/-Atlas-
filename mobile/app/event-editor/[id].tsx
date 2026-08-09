import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getEventEditor, updateEventEditorBasics, type EventEditorBasics } from "@/lib/api";

const tabs = [
  { id: "about", label: "О мероприятии" },
  { id: "tickets", label: "Билеты и цены" },
  { id: "map", label: "Места и карта" },
  { id: "checkout", label: "Покупатель" },
  { id: "review", label: "Проверка" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function localDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

export default function EventEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const eventId = String(params.id || "");
  const [event, setEvent] = useState<EventEditorBasics | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [active, setActive] = useState<TabId>("about");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const canManage = permissions.includes("EVENT_MANAGE");

  function fill(value: EventEditorBasics) {
    setEvent(value);
    setTitle(value.title);
    setDescription(value.description);
    setPosterUrl(value.posterUrl);
    const local = localDateTime(value.startsAt);
    setDate(local.date);
    setTime(local.time);
    setVenueName(value.venue.name);
    setCity(value.venue.city);
    setAddress(value.venue.address);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await getEventEditor(eventId);
        if (!mounted) return;
        fill(payload.event);
        setPermissions(payload.permissions);
      } catch (error) {
        if (mounted) Alert.alert("Не удалось открыть мероприятие", error instanceof Error ? error.message : "Ошибка");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [eventId]);

  const valid = useMemo(() => title.trim().length >= 3 && description.trim().length >= 20 && venueName.trim().length >= 2 && city.trim().length >= 2 && address.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time), [title, description, venueName, city, address, date, time]);

  async function save() {
    if (!canManage || !valid) {
      Alert.alert("Проверьте поля", "Название, описание, дата, время и данные площадки обязательны.");
      return;
    }
    const startsAt = new Date(`${date}T${time}:00+03:00`);
    if (Number.isNaN(startsAt.getTime())) {
      Alert.alert("Неверная дата", "Используйте формат YYYY-MM-DD и HH:MM.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateEventEditorBasics(eventId, {
        title: title.trim(),
        description: description.trim(),
        posterUrl: posterUrl.trim() || event?.posterUrl || "/assets/noa-live-tel-aviv.png",
        startsAt: startsAt.toISOString(),
        venueName: venueName.trim(),
        city: city.trim(),
        address: address.trim(),
      });
      fill(result.event);
      Alert.alert("Сохранено", "Изменения сохранены в том же мероприятии Atlas.");
    } catch (error) {
      Alert.alert("Не удалось сохранить", error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text>Мероприятие не найдено</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={25} color="#17213C" /></TouchableOpacity>
        <View style={styles.headerText}><Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text><Text style={styles.headerMeta}>{event.status}</Text></View>
        <View style={styles.iconButton}><Ionicons name="ellipsis-horizontal" size={24} color="#17213C" /></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {tabs.map((tab, index) => <TouchableOpacity key={tab.id} style={[styles.tab, active === tab.id && styles.tabActive]} onPress={() => setActive(tab.id)}><Text style={[styles.tabIndex, active === tab.id && styles.tabIndexActive]}>{String(index + 1).padStart(2, "0")}</Text><Text style={[styles.tabLabel, active === tab.id && styles.tabLabelActive]}>{tab.label}</Text></TouchableOpacity>)}
      </ScrollView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={10}>
        {active === "about" ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Основная информация</Text>
            <Text style={styles.sectionHelp}>Это те же данные мероприятия, которые используются в web back office.</Text>

            <Field label="Официальное название"><TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={50} editable={canManage} /></Field>
            <Field label="Полное описание"><TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline textAlignVertical="top" editable={canManage} /></Field>
            <Field label="Афиша URL"><TextInput style={styles.input} value={posterUrl} onChangeText={setPosterUrl} autoCapitalize="none" editable={canManage} /></Field>
            <View style={styles.row}>
              <View style={styles.half}><Field label="Дата"><TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" editable={canManage} /></Field></View>
              <View style={styles.half}><Field label="Начало"><TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" editable={canManage} /></Field></View>
            </View>
            <Field label="Площадка"><TextInput style={styles.input} value={venueName} onChangeText={setVenueName} editable={canManage} /></Field>
            <Field label="Город"><TextInput style={styles.input} value={city} onChangeText={setCity} editable={canManage} /></Field>
            <Field label="Адрес"><TextInput style={styles.input} value={address} onChangeText={setAddress} editable={canManage} /></Field>

            {!canManage && <Text style={styles.readOnly}>У вашей роли есть просмотр, но нет EVENT_MANAGE.</Text>}
            {canManage && <TouchableOpacity style={[styles.saveButton, (!valid || saving) && styles.disabled]} disabled={!valid || saving} onPress={save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Сохранить изменения</Text>}</TouchableOpacity>}
          </ScrollView>
        ) : (
          <View style={styles.pendingPanel}><Ionicons name="construct-outline" size={35} color="#6D45FF" /><Text style={styles.pendingTitle}>{tabs.find((tab) => tab.id === active)?.label}</Text><Text style={styles.pendingText}>Раздел уже закреплён за существующим back office. Подключаем его к тем же операциям без создания отдельной мобильной логики.</Text></View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: "#F5F6FA" }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6FA" },
  header: { height: 70, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E6E8EF" }, iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, headerText: { flex: 1, alignItems: "center" }, headerTitle: { fontSize: 18, fontWeight: "900", color: "#17213C", maxWidth: "90%" }, headerMeta: { fontSize: 11, color: "#7B8498", marginTop: 2 },
  tabs: { maxHeight: 76, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E6E8EF" }, tabsContent: { paddingHorizontal: 12, gap: 7, alignItems: "center" }, tab: { height: 54, minWidth: 115, borderRadius: 14, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#F4F5F8" }, tabActive: { backgroundColor: "#EEE9FF" }, tabIndex: { fontSize: 10, color: "#9AA2B1", fontWeight: "800" }, tabIndexActive: { color: "#6D45FF" }, tabLabel: { fontSize: 12, color: "#657086", fontWeight: "700", marginTop: 2 }, tabLabelActive: { color: "#4F2FE3" },
  content: { padding: 18, paddingBottom: 60 }, sectionTitle: { fontSize: 24, fontWeight: "900", color: "#17213C" }, sectionHelp: { color: "#7B8498", lineHeight: 19, marginTop: 5, marginBottom: 18 }, field: { marginBottom: 14 }, label: { fontSize: 12, fontWeight: "800", color: "#5C667B", marginBottom: 6 }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#DDE1EA", backgroundColor: "#fff", paddingHorizontal: 14, fontSize: 15, color: "#17213C" }, multiline: { minHeight: 132, paddingTop: 13, paddingBottom: 13 }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 },
  saveButton: { height: 55, borderRadius: 16, backgroundColor: "#6D45FF", alignItems: "center", justifyContent: "center", marginTop: 8 }, saveText: { color: "#fff", fontWeight: "900", fontSize: 16 }, disabled: { opacity: 0.45 }, readOnly: { color: "#A23A3A", marginVertical: 12 },
  pendingPanel: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 }, pendingTitle: { fontSize: 22, fontWeight: "900", color: "#17213C", marginTop: 12 }, pendingText: { textAlign: "center", color: "#737D91", lineHeight: 20, marginTop: 8 },
});
