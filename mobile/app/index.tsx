import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const actions = [
  ["calendar-outline", "Мероприятия", "Создание, редактирование и публикация"],
  ["ticket-outline", "Билеты и цены", "Категории, этапы продаж и лимиты"],
  ["people-outline", "Заявки", "Одобрение и отклонение запросов"],
  ["receipt-outline", "Заказы", "Продажи, отмены и перевыпуск билетов"],
  ["scan-outline", "Сканер", "Контроль входа и журнал проходов"],
  ["stats-chart-outline", "Аналитика", "Выручка, продажи и заполняемость"],
  ["map-outline", "Схема зала", "Столы, места, зоны и назначение цен"],
  ["shirt-outline", "Дизайн билета", "Шаблон, фото, тексты, QR и Wallet"],
  ["person-add-outline", "Команда", "Роли, права и доступ к мероприятиям"],
] as const;

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ATLAS OFFICE</Text>
            <Text style={styles.title}>Доброе утро, Игорь</Text>
            <Text style={styles.subtitle}>Управление мероприятиями в одном приложении</Text>
          </View>
          <TouchableOpacity style={styles.avatar} accessibilityLabel="Профиль">
            <Text style={styles.avatarText}>ИР</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Сегодня</Text>
          <Text style={styles.summaryValue}>124 билета</Text>
          <Text style={styles.summaryMeta}>3 активных мероприятия · тестовые данные</Text>
        </View>

        <Text style={styles.sectionTitle}>Управление</Text>
        <View style={styles.grid}>
          {actions.map(([icon, title, description]) => (
            <TouchableOpacity key={title} style={styles.card} activeOpacity={0.75}>
              <View style={styles.iconWrap}>
                <Ionicons name={icon} size={23} color="#111827" />
              </View>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardText}>{description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6F8" },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: "#6B7280", marginBottom: 6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#6B7280", maxWidth: 270 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800" },
  summaryCard: { backgroundColor: "#111827", borderRadius: 24, padding: 22, marginBottom: 28 },
  summaryLabel: { color: "#A7F3D0", fontSize: 13, fontWeight: "700" },
  summaryValue: { color: "white", fontSize: 30, fontWeight: "800", marginTop: 8 },
  summaryMeta: { color: "#D1D5DB", fontSize: 13, marginTop: 7 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "48%", minHeight: 164, backgroundColor: "white", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  iconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 7 },
  cardText: { fontSize: 12.5, lineHeight: 18, color: "#6B7280" },
});
