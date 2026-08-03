import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";
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

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  const event = data?.events.find((item) => item.id === id);
  const percent = event?.capacity ? Math.min(100, Math.round((event.sold / event.capacity) * 100)) : 0;

  return (
    <OfficePage title={event?.title || "Мероприятие"} subtitle={event ? `${eventDate(event.startsAt)} · ${event.venue.name}, ${event.venue.city}` : "Загрузка данных мероприятия."}>
      {loading ? <ActivityIndicator size="large" /> : event ? (
        <>
          <View style={styles.statusRow}>
            <View style={styles.status}><Text style={styles.statusText}>{event.status === "PUBLISHED" ? "Опубликовано" : event.status === "DRAFT" ? "Черновик" : "Прошло"}</Text></View>
            <Text style={styles.mode}>{event.mapEnabled ? "Схема зала" : "Без схемы"}</Text>
          </View>
          <View style={officeStyles.card}>
            <View style={officeStyles.row}>
              <View><Text style={officeStyles.metric}>{event.sold}</Text><Text style={officeStyles.label}>Продано</Text></View>
              <View><Text style={officeStyles.metric}>{event.capacity || 0}</Text><Text style={officeStyles.label}>Вместимость</Text></View>
              <View><Text style={officeStyles.metric}>{percent}%</Text><Text style={officeStyles.label}>Заполнение</Text></View>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
          </View>
          <TouchableOpacity style={officeStyles.button} onPress={() => router.push("/orders")} accessibilityRole="button">
            <Text style={officeStyles.buttonText}>Посмотреть заказы</Text>
          </TouchableOpacity>
          <TouchableOpacity style={officeStyles.secondaryButton} onPress={() => router.push("/analytics")} accessibilityRole="button">
            <Text style={officeStyles.secondaryButtonText}>Открыть аналитику</Text>
          </TouchableOpacity>
          <TouchableOpacity style={officeStyles.secondaryButton} onPress={() => Linking.openURL(`https://www.atlas-one.co/events/${event.id}`)} accessibilityRole="button">
            <Text style={officeStyles.secondaryButtonText}>Открыть страницу мероприятия</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={officeStyles.empty}>
          <Text style={officeStyles.emptyTitle}>Мероприятие не найдено</Text>
          <Text style={officeStyles.emptyText}>Обновите главную страницу и откройте карточку снова.</Text>
        </View>
      )}
    </OfficePage>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  status: { backgroundColor: "#ECFDF3", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  statusText: { fontSize: 11, fontWeight: "800", color: "#166534" },
  mode: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  track: { height: 9, borderRadius: 99, backgroundColor: "#E5E7EB", overflow: "hidden", marginTop: 18 },
  fill: { height: "100%", borderRadius: 99, backgroundColor: "#111827" },
});