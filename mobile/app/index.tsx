import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { atlasLogoUri } from "@/lib/atlas-brand";
import { getDashboard, login, logout, type DashboardPayload } from "@/lib/api";

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Неверный email или пароль.",
  PASSWORD_NOT_SET: "Для аккаунта ещё не создан пароль.",
  EMAIL_NOT_VERIFIED: "Сначала подтвердите email.",
  LOCKED: "Слишком много попыток. Попробуйте через 15 минут.",
  UNAUTHORIZED: "Сессия завершена. Войдите снова.",
};

function eventDate(value: string) {
  return new Intl.DateTimeFormat("ru-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

function AtlasLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      source={{ uri: atlasLogoUri }}
      style={compact ? styles.logoCompact : styles.logo}
      resizeMode="contain"
      accessibilityLabel="Официальный логотип Atlas One"
    />
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await getDashboard());
    } catch (error) {
      setData(null);
      const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      if (code !== "UNAUTHORIZED" && !silent) {
        Alert.alert("Atlas Office", errorMessages[code] || "Не удалось загрузить данные.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const events = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.events || [];
    return (data?.events || []).filter((event) =>
      `${event.title} ${event.venue.name} ${event.venue.city}`.toLowerCase().includes(query),
    );
  }, [data?.events, search]);

  async function submitLogin() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setPassword("");
      await load(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      Alert.alert("Не удалось войти", errorMessages[code] || "Проверьте данные и соединение.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setMenuOpen(false);
    await logout();
    setData(null);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Загрузка Atlas Office...</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.loginWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.loginCard}>
            <View style={styles.loginLogoPlate}><AtlasLogo /></View>
            <Text style={styles.loginTitle}>Вход для организаторов</Text>
            <Text style={styles.loginSubtitle}>Управляйте мероприятиями, заказами и входом в одном приложении.</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Email" />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Пароль" onSubmitEditing={() => void submitLogin()} />
            <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabled]} onPress={() => void submitLogin()} disabled={submitting} accessibilityRole="button" accessibilityLabel="Войти в Atlas Office">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Войти</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const menuItems = [
    ["calendar-outline", "Мероприятия", "/"],
    ["receipt-outline", "Заказы", "/orders"],
    ["scan-outline", "Сканер", "/scanner"],
    ["stats-chart-outline", "Аналитика", "/analytics"],
    ["person-outline", "Профиль", "/profile"],
  ] as const;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <AtlasLogo />
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Открыть меню">
          <Ionicons name="menu" size={27} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} />}
      >
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.title}>Мои мероприятия</Text>
            <Text style={styles.subtitle}>{data.summary.activeEvents} активных</Text>
          </View>
          <TouchableOpacity style={styles.profileChip} onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Открыть профиль">
            <Ionicons name="person-outline" size={20} color="#17213C" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#7B8498" />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Поиск мероприятия" placeholderTextColor="#98A0AF" />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Очистить поиск">
              <Ionicons name="close-circle" size={20} color="#98A0AF" />
            </TouchableOpacity>
          )}
        </View>

        {events.map((event) => {
          const percent = event.capacity ? Math.min(100, Math.round((event.sold / event.capacity) * 100)) : 0;
          return (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              activeOpacity={0.84}
              onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Открыть мероприятие ${event.title}`}
            >
              <View style={styles.posterWrap}>
                {event.posterUrl ? (
                  <Image source={{ uri: event.posterUrl }} style={styles.poster} resizeMode="cover" />
                ) : (
                  <View style={styles.posterFallback}><Ionicons name="images-outline" size={30} color="#7B8498" /></View>
                )}
              </View>
              <View style={styles.eventBody}>
                <View style={styles.eventTitleRow}>
                  <View style={styles.eventText}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>{eventDate(event.startsAt)}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>{event.venue.name}, {event.venue.city}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={21} color="#8A92A3" />
                </View>
                <View style={styles.metricRow}>
                  <View><Text style={styles.metricValue}>{event.sold}</Text><Text style={styles.metricLabel}>продано</Text></View>
                  <View><Text style={styles.metricValue}>{event.capacity || "-"}</Text><Text style={styles.metricLabel}>вместимость</Text></View>
                  <View><Text style={styles.metricValue}>{percent}%</Text><Text style={styles.metricLabel}>заполнение</Text></View>
                </View>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
              </View>
            </TouchableOpacity>
          );
        })}

        {!events.length && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Мероприятия не найдены</Text>
            <Text style={styles.emptyText}>Измени запрос или обнови список.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => { setSearch(""); void load(true); }} accessibilityRole="button" accessibilityLabel="Обновить мероприятия">
          <Ionicons name="calendar" size={23} color="#6D45FF" />
          <Text style={styles.navActive}>Мероприятия</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/scanner")} accessibilityRole="button" accessibilityLabel="Открыть сканер">
          <Ionicons name="scan-outline" size={23} color="#737B8D" />
          <Text style={styles.navText}>Сканер</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Открыть профиль">
          <Ionicons name="person-outline" size={23} color="#737B8D" />
          <Text style={styles.navText}>Профиль</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Закрыть меню" />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <AtlasLogo compact />
              <TouchableOpacity onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Закрыть меню">
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.drawerName}>{data.user.name}</Text>
            <Text style={styles.drawerRole}>{data.user.organization?.name || "Организатор"}</Text>
            {menuItems.map(([icon, label, route]) => (
              <TouchableOpacity key={label} style={styles.drawerItem} onPress={() => { setMenuOpen(false); router.push(route); }} accessibilityRole="button" accessibilityLabel={`Открыть раздел ${label}`}>
                <Ionicons name={icon} size={21} color="#DCE2F2" />
                <Text style={styles.drawerItemText}>{label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#63708B" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.logoutItem} onPress={() => void signOut()} accessibilityRole="button" accessibilityLabel="Выйти из аккаунта">
              <Ionicons name="log-out-outline" size={21} color="#FF6B6B" />
              <Text style={styles.logoutText}>Выйти</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#F5F6FA" },
  loadingText: { color: "#747D90" },
  loginWrap: { flex: 1, justifyContent: "center", padding: 20 },
  loginCard: { backgroundColor: "#fff", borderRadius: 26, padding: 24, gap: 14 },
  loginLogoPlate: { minHeight: 76, borderRadius: 18, backgroundColor: "#071536", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  logo: { width: 188, height: 54 },
  logoCompact: { width: 145, height: 42 },
  loginTitle: { fontSize: 28, fontWeight: "900", color: "#17213C", marginTop: 10 },
  loginSubtitle: { fontSize: 15, lineHeight: 22, color: "#727B8E", marginBottom: 8 },
  input: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: "#DDE1EA", paddingHorizontal: 16, fontSize: 16, backgroundColor: "#FAFBFD" },
  primaryButton: { height: 54, borderRadius: 15, backgroundColor: "#6D45FF", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  topBar: { minHeight: 82, backgroundColor: "#071536", paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.09)", alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 110 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 27, fontWeight: "900", color: "#17213C" },
  subtitle: { fontSize: 13, color: "#7B8498", marginTop: 4 },
  profileChip: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E6E8EF" },
  searchBox: { height: 50, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E8F0", flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 10, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 15, color: "#17213C" },
  eventCard: { backgroundColor: "#fff", borderRadius: 20, marginBottom: 13, padding: 10, flexDirection: "row", borderWidth: 1, borderColor: "#E7E9F0", shadowColor: "#0B1633", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  posterWrap: { width: 104, height: 138, borderRadius: 14, overflow: "hidden", backgroundColor: "#EDF0F5" },
  poster: { width: "100%", height: "100%" },
  posterFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  eventBody: { flex: 1, paddingLeft: 13, paddingVertical: 4 },
  eventTitleRow: { flexDirection: "row", alignItems: "flex-start" },
  eventText: { flex: 1, paddingRight: 6 },
  eventTitle: { fontSize: 17, lineHeight: 21, fontWeight: "800", color: "#17213C" },
  eventMeta: { fontSize: 12.5, lineHeight: 18, color: "#778094", marginTop: 2 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  metricValue: { fontSize: 15, fontWeight: "800", color: "#17213C" },
  metricLabel: { fontSize: 10.5, color: "#8A92A3", marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 99, backgroundColor: "#EBE7FF", marginTop: 11, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#6D45FF" },
  empty: { padding: 28, backgroundColor: "#fff", borderRadius: 20, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#17213C" },
  emptyText: { fontSize: 13, color: "#7B8498", marginTop: 6 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 82, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E6E8EF", flexDirection: "row", justifyContent: "space-around", paddingTop: 11 },
  navItem: { alignItems: "center", minWidth: 90 },
  navActive: { color: "#6D45FF", fontSize: 11.5, fontWeight: "800", marginTop: 4 },
  navText: { color: "#747D90", fontSize: 11.5, fontWeight: "600", marginTop: 4 },
  modalRoot: { flex: 1, flexDirection: "row" },
  backdrop: { flex: 1, backgroundColor: "rgba(1,8,26,0.55)" },
  drawer: { width: "82%", backgroundColor: "#071536", paddingTop: 58, paddingHorizontal: 22, paddingBottom: 30 },
  drawerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  drawerName: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 32 },
  drawerRole: { color: "#8E9AB3", fontSize: 13, marginTop: 4, marginBottom: 24 },
  drawerItem: { height: 54, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", gap: 13 },
  drawerItemText: { flex: 1, color: "#F2F5FB", fontSize: 15, fontWeight: "600" },
  logoutItem: { marginTop: "auto", height: 54, flexDirection: "row", alignItems: "center", gap: 13 },
  logoutText: { color: "#FF6B6B", fontSize: 15, fontWeight: "700" },
});
