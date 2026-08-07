import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboard, type DashboardPayload } from "@/lib/api";

function eventDate(value: string) {
  return new Intl.DateTimeFormat("ru-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

export default function EventDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getDashboard().then(setData).finally(() => setLoading(false)); }, []);

  const event = data?.events.find((item) => item.id === id);
  const attendancePercent = event?.sold ? Math.min(100, Math.round((event.checkedIn / event.sold) * 100)) : 0;
  const actions = event ? [
    { icon: "receipt-outline", title: "Заказы", subtitle: "Покупки и заявки", disabled: false, onPress: () => router.push({ pathname: "/orders", params: { eventId: event.id } }) },
    { icon: "scan-outline", title: "Сканер", subtitle: event.checkInOpen ? "Вход открыт" : `Доступен с ${eventDate(event.checkInOpensAt)}`, disabled: !event.checkInOpen, onPress: () => router.push({ pathname: "/scanner", params: { eventId: event.id, eventTitle: event.title } }) },
    { icon: "stats-chart-outline", title: "Аналитика", subtitle: "Продажи и динамика", disabled: false, onPress: () => router.push("/analytics") },
    { icon: "people-outline", title: "Клиенты", subtitle: "Посетители события", disabled: false, onPress: () => router.push({ pathname: "/orders", params: { eventId: event.id } }) },
    { icon: "globe-outline", title: "Страница", subtitle: "Открыть на сайте", disabled: false, onPress: () => Linking.openURL(`https://www.atlas-one.co/events/${event.id}`) },
  ] as const : [];

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text style={styles.emptyTitle}>Мероприятие не найдено</Text><TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>Вернуться</Text></TouchableOpacity></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {event.posterUrl ? <Image source={{ uri: event.posterUrl }} style={styles.heroImage} resizeMode="cover" /> : <View style={styles.heroFallback}><Ionicons name="images-outline" size={48} color="#7B8498" /></View>}
          <View style={styles.heroShade} />
          <View style={styles.heroHeader}>
            <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} accessibilityLabel="Назад"><Ionicons name="chevron-back" size={25} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={styles.circleButton} onPress={() => Linking.openURL(`https://www.atlas-one.co/events/${event.id}`)} accessibilityLabel="Открыть публичную страницу"><Ionicons name="ellipsis-horizontal" size={23} color="#fff" /></TouchableOpacity>
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.dateTile}><Text style={styles.dateDay}>{new Date(event.startsAt).getDate()}</Text><Text style={styles.dateMonth}>{new Intl.DateTimeFormat("ru", { month: "short", timeZone: "Asia/Jerusalem" }).format(new Date(event.startsAt)).toUpperCase()}</Text></View>
            <View style={styles.heroText}><Text style={styles.heroTitle}>{event.title}</Text><Text style={styles.heroMeta}>{event.venue.name}, {event.venue.city}</Text></View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.statusRow}>
            <View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>Активно</Text></View>
            <Text style={styles.dateText}>{eventDate(event.startsAt)}</Text>
          </View>

          <View style={styles.salesCard}>
            <View style={styles.salesHeader}><Text style={styles.salesTitle}>Посетители на входе</Text><Text style={styles.percent}>{attendancePercent}%</Text></View>
            <Text style={styles.salesValue}>{event.checkedIn} <Text style={styles.salesCapacity}>/ {event.sold}</Text></Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${attendancePercent}%` }]} /></View>
            <View style={styles.metrics}>
              <View><Text style={styles.metricValue}>{event.checkedIn}</Text><Text style={styles.metricLabel}>пришли</Text></View>
              <View><Text style={styles.metricValue}>{Math.max(0, event.sold - event.checkedIn)}</Text><Text style={styles.metricLabel}>ещё ожидаются</Text></View>
              <View><Text style={styles.metricValue}>{event.sold}</Text><Text style={styles.metricLabel}>билетов продано</Text></View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Управление мероприятием</Text>
          <View style={styles.actionsList}>
            {actions.map((action) => (
              <TouchableOpacity key={action.title} style={[styles.actionRow, action.disabled && styles.actionDisabled]} onPress={action.onPress} disabled={action.disabled} activeOpacity={0.76} accessibilityLabel={action.title}>
                <View style={[styles.actionIcon, action.disabled && styles.actionIconDisabled]}><Ionicons name={action.icon} size={22} color={action.disabled ? "#9AA1B0" : "#6D45FF"} /></View>
                <View style={styles.actionCopy}><Text style={[styles.actionTitle, action.disabled && styles.actionTitleDisabled]}>{action.title}</Text><Text style={styles.actionSubtitle}>{action.subtitle}</Text></View>
                <Ionicons name={action.disabled ? "lock-closed-outline" : "chevron-forward"} size={20} color="#9AA1B0" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace("/")}><Ionicons name="calendar" size={23} color="#6D45FF" /><Text style={styles.navActive}>Мероприятия</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}><Ionicons name="person-outline" size={23} color="#737B8D" /><Text style={styles.navText}>Профиль</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6FA", gap: 16, padding: 20 },
  content: { paddingBottom: 100 },
  hero: { height: 330, backgroundColor: "#101936" },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,28,0.34)" },
  heroHeader: { position: "absolute", left: 16, right: 16, top: 14, flexDirection: "row", justifyContent: "space-between" },
  circleButton: { width: 44, height: 44, borderRadius: 17, backgroundColor: "rgba(5,12,32,0.62)", alignItems: "center", justifyContent: "center" },
  heroCopy: { position: "absolute", left: 18, right: 18, bottom: 24, flexDirection: "row", alignItems: "center" },
  dateTile: { width: 64, height: 70, borderRadius: 18, backgroundColor: "#6D45FF", alignItems: "center", justifyContent: "center" },
  dateDay: { color: "#fff", fontSize: 26, fontWeight: "900" },
  dateMonth: { color: "#DDD5FF", fontSize: 11, fontWeight: "800", marginTop: 1 },
  heroText: { flex: 1, marginLeft: 14 },
  heroTitle: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900" },
  heroMeta: { color: "#D8DDE8", fontSize: 14, marginTop: 5 },
  sheet: { marginTop: -14, backgroundColor: "#F5F6FA", borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  status: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#EAF9EF", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2CBF64" },
  statusText: { color: "#198144", fontSize: 12, fontWeight: "800" },
  dateText: { color: "#737C90", fontSize: 12.5 },
  salesCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#E7E9F0" },
  salesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  salesTitle: { fontSize: 14, fontWeight: "700", color: "#737C90" },
  percent: { fontSize: 14, fontWeight: "800", color: "#6D45FF" },
  salesValue: { fontSize: 31, fontWeight: "900", color: "#17213C", marginTop: 7 },
  salesCapacity: { fontSize: 19, color: "#8890A1", fontWeight: "600" },
  track: { height: 7, borderRadius: 99, backgroundColor: "#ECE8FF", overflow: "hidden", marginTop: 13 },
  fill: { height: "100%", borderRadius: 99, backgroundColor: "#6D45FF" },
  metrics: { flexDirection: "row", justifyContent: "space-between", paddingTop: 17, marginTop: 17, borderTopWidth: 1, borderTopColor: "#EEF0F4" },
  metricValue: { fontSize: 17, fontWeight: "800", color: "#17213C" },
  metricLabel: { fontSize: 11, color: "#8B93A3", marginTop: 3 },
  sectionTitle: { fontSize: 19, fontWeight: "900", color: "#17213C", marginTop: 24, marginBottom: 11 },
  actionsList: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#E7E9F0" },
  actionRow: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#EEF0F4" },
  actionDisabled: { opacity: 0.58 },
  actionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#F0EDFF", alignItems: "center", justifyContent: "center" },
  actionIconDisabled: { backgroundColor: "#F0F1F4" },
  actionCopy: { flex: 1, marginLeft: 12 },
  actionTitle: { fontSize: 15, fontWeight: "800", color: "#17213C" },
  actionTitleDisabled: { color: "#818898" },
  actionSubtitle: { fontSize: 12, color: "#858D9E", marginTop: 3 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 82, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E6E8EF", flexDirection: "row", justifyContent: "space-around", paddingTop: 11 },
  navItem: { alignItems: "center", minWidth: 120 },
  navActive: { color: "#6D45FF", fontSize: 11.5, fontWeight: "800", marginTop: 4 },
  navText: { color: "#747D90", fontSize: 11.5, fontWeight: "600", marginTop: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#17213C" },
  backButton: { backgroundColor: "#6D45FF", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13 },
  backText: { color: "#fff", fontWeight: "800" },
});
