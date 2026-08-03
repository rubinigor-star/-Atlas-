import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { getDashboard, login, type DashboardPayload } from "@/lib/api";

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Неверный email или пароль.",
  PASSWORD_NOT_SET: "Для аккаунта ещё не создан пароль.",
  EMAIL_NOT_VERIFIED: "Сначала подтвердите email.",
  LOCKED: "Слишком много попыток. Попробуйте через 15 минут.",
  UNAUTHORIZED: "Сессия завершена. Войдите снова.",
  API_URL_NOT_CONFIGURED: "Не настроен адрес сервера Atlas.",
};

function money(minor: number) {
  return new Intl.NumberFormat("ru-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(minor / 100);
}

function eventDate(value: string) {
  return new Intl.DateTimeFormat("ru-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

export default function DashboardScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await getDashboard());
    } catch (error) {
      setData(null);
      const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      if (code !== "UNAUTHORIZED" && !silent) Alert.alert("Atlas Office", errorMessages[code] || "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const initials = useMemo(() => {
    const name = data?.user.name?.trim() || "Atlas";
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }, [data?.user.name]);

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

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /><Text style={styles.loadingText}>Загрузка Atlas Office...</Text></SafeAreaView>;
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.loginWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.loginCard}>
            <View style={styles.logo}><Text style={styles.logoText}>A</Text></View>
            <Text style={styles.eyebrow}>ATLAS ONE OFFICE</Text>
            <Text style={styles.loginTitle}>Вход для организаторов</Text>
            <Text style={styles.loginSubtitle}>Мероприятия, продажи, заявки и команда в одном приложении.</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@example.com" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Пароль</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Введите пароль" onSubmitEditing={submitLogin} />
            </View>
            <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabled]} onPress={submitLogin} disabled={submitting} accessibilityRole="button" accessibilityLabel="Войти в Atlas Office">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Войти</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const quickActions = [
    { icon: "people-outline", title: "Заявки", badge: data.summary.pendingRequests, route: "/requests" },
    { icon: "receipt-outline", title: "Заказы", badge: data.summary.paidOrders, route: "/orders" },
    { icon: "scan-outline", title: "Сканер", badge: null, route: "/scanner" },
    { icon: "stats-chart-outline", title: "Аналитика", badge: null, route: "/analytics" },
  ] as const;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ATLAS OFFICE</Text>
            <Text style={styles.title}>Здравствуйте, {data.user.name.split(" ")[0]}</Text>
            <Text style={styles.subtitle}>{data.user.organization?.name || data.user.jobTitle || "Управление платформой"}</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Открыть профиль">
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.summaryCard} onPress={() => router.push("/analytics")} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel="Открыть аналитику продаж">
          <View style={styles.rowBetween}>
            <Text style={styles.summaryLabel}>Оплаченные продажи</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </View>
          <Text style={styles.summaryValue}>{money(data.summary.revenueMinor)}</Text>
          <Text style={styles.summaryMeta}>{data.summary.paidOrders} заказов · {data.summary.activeEvents} активных мероприятий</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => router.push("/requests")} activeOpacity={0.78} accessibilityRole="button">
            <Text style={styles.statValue}>{data.summary.pendingRequests}</Text>
            <Text style={styles.statLabel}>Новые заявки</Text>
            <Ionicons name="arrow-forward" size={17} color="#6B7280" style={styles.statArrow} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stat} onPress={() => router.push("/analytics")} activeOpacity={0.78} accessibilityRole="button">
            <Text style={styles.statValue}>{data.events.reduce((sum, event) => sum + event.sold, 0)}</Text>
            <Text style={styles.statLabel}>Продано билетов</Text>
            <Ionicons name="arrow-forward" size={17} color="#6B7280" style={styles.statArrow} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Мероприятия</Text>
          <Text style={styles.sectionCount}>{data.events.length}</Text>
        </View>

        {data.events.slice(0, 8).map((event) => {
          const percent = event.capacity ? Math.min(100, Math.round((event.sold / event.capacity) * 100)) : 0;
          return (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              activeOpacity={0.78}
              onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Открыть мероприятие ${event.title}`}
            >
              <View style={styles.eventTop}>
                <View style={styles.eventIcon}><Ionicons name="calendar-outline" size={21} color="#111827" /></View>
                <View style={styles.eventCopy}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventMeta}>{eventDate(event.startsAt)} · {event.venue.city}</Text>
                </View>
                <View style={[styles.status, event.status === "DRAFT" && styles.statusDraft]}><Text style={styles.statusText}>{event.status === "PUBLISHED" ? "Опубликовано" : event.status === "DRAFT" ? "Черновик" : "Прошло"}</Text></View>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
              <View style={styles.eventBottom}><Text style={styles.eventSales}>{event.sold} / {event.capacity || "-"} билетов</Text><View style={styles.eventLink}><Text style={styles.eventSales}>{percent}%</Text><Ionicons name="chevron-forward" size={15} color="#6B7280" /></View></View>
            </TouchableOpacity>
          );
        })}

        {!data.events.length && <View style={styles.empty}><Text style={styles.emptyTitle}>Мероприятий пока нет</Text><Text style={styles.emptyText}>Создайте первое мероприятие в Atlas Office.</Text></View>}

        <Text style={styles.sectionTitle}>Быстрые действия</Text>
        <View style={styles.grid}>
          {quickActions.map((action) => (
            <TouchableOpacity key={action.title} style={styles.actionCard} onPress={() => router.push(action.route)} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={`Открыть раздел ${action.title}`}>
              <Ionicons name={action.icon} size={24} color="#111827" />
              <Text style={styles.actionTitle}>{action.title}</Text>
              {typeof action.badge === "number" && <Text style={styles.actionBadge}>{action.badge}</Text>}
              <Ionicons name="arrow-forward" size={18} color="#6B7280" style={styles.actionArrow} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6F8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6F8", gap: 12 },
  loadingText: { color: "#6B7280" },
  loginWrap: { flex: 1, justifyContent: "center", padding: 20 },
  loginCard: { backgroundColor: "white", borderRadius: 28, padding: 24, borderWidth: 1, borderColor: "#E5E7EB" },
  logo: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoText: { color: "white", fontSize: 26, fontWeight: "900" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: "#6B7280", marginBottom: 7 },
  loginTitle: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: "#111827" },
  loginSubtitle: { marginTop: 10, marginBottom: 26, fontSize: 15, lineHeight: 22, color: "#6B7280" },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 14, paddingHorizontal: 16, fontSize: 16, backgroundColor: "#FAFAFA" },
  primaryButton: { height: 54, borderRadius: 15, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonText: { color: "white", fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  content: { padding: 20, paddingBottom: 44 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  headerCopy: { flex: 1, paddingRight: 14 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 5, fontSize: 14, color: "#6B7280" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800" },
  summaryCard: { backgroundColor: "#111827", borderRadius: 24, padding: 22, marginBottom: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "#A7F3D0", fontSize: 13, fontWeight: "700" },
  summaryValue: { color: "white", fontSize: 31, fontWeight: "800", marginTop: 8 },
  summaryMeta: { color: "#D1D5DB", fontSize: 13, marginTop: 7 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  stat: { flex: 1, backgroundColor: "white", borderRadius: 18, padding: 17, borderWidth: 1, borderColor: "#E5E7EB" },
  statValue: { fontSize: 24, fontWeight: "800", color: "#111827" },
  statLabel: { marginTop: 5, fontSize: 12.5, color: "#6B7280" },
  statArrow: { position: "absolute", right: 14, bottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 14 },
  sectionCount: { fontSize: 13, fontWeight: "800", color: "#6B7280", backgroundColor: "#E5E7EB", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  eventCard: { backgroundColor: "white", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12 },
  eventTop: { flexDirection: "row", alignItems: "center" },
  eventIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  eventCopy: { flex: 1, marginLeft: 12, marginRight: 8 },
  eventTitle: { fontSize: 15.5, fontWeight: "800", color: "#111827" },
  eventMeta: { fontSize: 12.5, color: "#6B7280", marginTop: 4 },
  status: { backgroundColor: "#ECFDF3", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  statusDraft: { backgroundColor: "#FFF7ED" },
  statusText: { fontSize: 10, fontWeight: "800", color: "#374151" },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: "#E5E7EB", marginTop: 16, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#111827", borderRadius: 99 },
  eventBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  eventLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  eventSales: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  empty: { backgroundColor: "white", padding: 22, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: "#E5E7EB" },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  emptyText: { fontSize: 13, color: "#6B7280", marginTop: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: { width: "48%", minHeight: 112, backgroundColor: "white", borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#E5E7EB" },
  actionTitle: { marginTop: 16, fontSize: 15, fontWeight: "800", color: "#111827" },
  actionBadge: { position: "absolute", top: 14, right: 14, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: "#111827", color: "white", textAlign: "center", lineHeight: 24, fontSize: 11, fontWeight: "800" },
  actionArrow: { position: "absolute", right: 15, bottom: 15 },
});