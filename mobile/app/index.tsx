import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AtlasLogo } from "@/components/AtlasLogo";
import { getDashboard, login, type DashboardPayload } from "@/lib/api";

function safeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(value: unknown) {
  const date = safeDate(value);
  if (!date) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(date);
}

function money(minor: number) {
  return new Intl.NumberFormat("ru-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(minor / 100);
}

export default function DashboardScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      setData(await getDashboard());
    } catch (error) {
      setData(null);
      if (!silent && error instanceof Error && error.message !== "UNAUTHORIZED") Alert.alert("Atlas Office", "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const events = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.events || [])
      .filter((event) => event.status === "PUBLISHED")
      .filter((event) => !query || `${event.title} ${event.venue.name} ${event.venue.city}`.toLowerCase().includes(query))
      .sort((a, b) => (safeDate(a.startsAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (safeDate(b.startsAt)?.getTime() ?? Number.MAX_SAFE_INTEGER));
  }, [data?.events, search]);

  async function submitLogin() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setPassword("");
      await load(true);
    } catch {
      Alert.alert("Не удалось войти", "Проверьте email и пароль.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;

  if (!data) {
    return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.loginWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}><View style={styles.loginCard}><AtlasLogo width={184} /><Text style={styles.loginTitle}>Вход для организаторов</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" /><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Пароль" onSubmitEditing={submitLogin} /><TouchableOpacity style={styles.primaryButton} onPress={submitLogin}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Войти</Text>}</TouchableOpacity></View></KeyboardAvoidingView></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}><AtlasLogo width={160} /><TouchableOpacity style={styles.profileButton} onPress={() => router.push("/profile")}><Ionicons name="person-outline" size={22} color="#fff" /></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} />}>
        <View style={styles.heading}><Text style={styles.title}>Мои мероприятия</Text><Text style={styles.subtitle}>{events.length} активных</Text></View>
        <View style={styles.searchBox}><Ionicons name="search" size={19} color="#7B8498" /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Поиск мероприятия" /></View>
        {events.map((event) => {
          const attendance = event.sold ? Math.min(100, Math.round((event.checkedIn / event.sold) * 100)) : 0;
          return (
            <TouchableOpacity key={event.id} style={styles.eventRow} activeOpacity={0.82} onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}>
              <View style={styles.posterWrap}>{event.posterUrl ? <Image source={{ uri: event.posterUrl }} style={styles.poster} /> : <Ionicons name="images-outline" size={28} color="#8A92A3" />}</View>
              <View style={styles.eventInfo}>
                <View style={styles.titleRow}><Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text><Ionicons name="chevron-forward" size={19} color="#98A0AF" /></View>
                <Text style={styles.meta}>{eventDate(event.startsAt)}</Text>
                <Text style={styles.meta} numberOfLines={1}>{event.venue.name}, {event.venue.city}</Text>
                <View style={styles.statsRow}><Text style={styles.statStrong}>{event.sold} продано</Text><Text style={styles.stat}>{event.checkedIn} пришли</Text><Text style={styles.stat}>{attendance}%</Text></View>
                <View style={styles.progress}><View style={[styles.progressFill, { width: `${attendance}%` }]} /></View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.bottomNav}><TouchableOpacity style={styles.navItem}><Ionicons name="calendar" size={22} color="#6D45FF" /><Text style={styles.navActive}>Мероприятия</Text></TouchableOpacity><TouchableOpacity style={styles.navItem} onPress={() => router.push("/orders")}><Ionicons name="receipt-outline" size={22} color="#747D90" /><Text style={styles.navText}>Заказы</Text></TouchableOpacity><TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}><Ionicons name="person-outline" size={22} color="#747D90" /><Text style={styles.navText}>Профиль</Text></TouchableOpacity></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { height: 74, backgroundColor: "#071536", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, profileButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.09)" },
  content: { padding: 14, paddingBottom: 100 }, heading: { marginBottom: 12 }, title: { fontSize: 27, fontWeight: "900", color: "#17213C" }, subtitle: { color: "#7B8498", marginTop: 3 },
  searchBox: { height: 48, backgroundColor: "#fff", borderRadius: 15, borderWidth: 1, borderColor: "#E2E5EC", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, marginBottom: 12 }, searchInput: { flex: 1, fontSize: 15 },
  eventRow: { minHeight: 126, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#E4E7ED", marginBottom: 10, padding: 10, flexDirection: "row" }, posterWrap: { width: 84, height: 106, borderRadius: 13, overflow: "hidden", backgroundColor: "#E9ECF2", alignItems: "center", justifyContent: "center" }, poster: { width: "100%", height: "100%", resizeMode: "cover" },
  eventInfo: { flex: 1, paddingLeft: 12 }, titleRow: { flexDirection: "row", alignItems: "flex-start" }, eventTitle: { flex: 1, fontSize: 16, lineHeight: 20, fontWeight: "900", color: "#17213C", paddingRight: 6 }, meta: { fontSize: 11.5, color: "#7D8698", marginTop: 3 }, statsRow: { flexDirection: "row", gap: 11, marginTop: 9 }, statStrong: { fontSize: 11.5, fontWeight: "800", color: "#17213C" }, stat: { fontSize: 11.5, color: "#687287" }, progress: { height: 5, backgroundColor: "#ECE8FF", borderRadius: 99, overflow: "hidden", marginTop: 8 }, progressFill: { height: "100%", backgroundColor: "#6D45FF" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 78, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E6E8EF", flexDirection: "row", justifyContent: "space-around", paddingTop: 10 }, navItem: { alignItems: "center", minWidth: 90 }, navActive: { color: "#6D45FF", fontSize: 11, fontWeight: "800", marginTop: 3 }, navText: { color: "#747D90", fontSize: 11, marginTop: 3 },
  loginWrap: { flex: 1, justifyContent: "center", padding: 20 }, loginCard: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 14 }, loginTitle: { fontSize: 26, fontWeight: "900", color: "#17213C" }, input: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: "#DDE1EA", paddingHorizontal: 16 }, primaryButton: { height: 54, borderRadius: 15, backgroundColor: "#6D45FF", alignItems: "center", justifyContent: "center" }, primaryButtonText: { color: "#fff", fontWeight: "800" },
});
