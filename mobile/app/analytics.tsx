import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";
import { getDashboard, type DashboardPayload } from "@/lib/api";

function money(minor: number) {
  return new Intl.NumberFormat("ru-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(minor / 100);
}

export default function AnalyticsScreen() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  const sold = data?.events.reduce((sum, event) => sum + event.sold, 0) ?? 0;
  const capacity = data?.events.reduce((sum, event) => sum + event.capacity, 0) ?? 0;

  return (
    <OfficePage title="Аналитика" subtitle="Ключевые показатели продаж и мероприятий.">
      {loading ? <ActivityIndicator size="large" /> : (
        <>
          <View style={styles.grid}>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{money(data?.summary.revenueMinor ?? 0)}</Text><Text style={styles.metricLabel}>Выручка</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data?.summary.paidOrders ?? 0}</Text><Text style={styles.metricLabel}>Заказы</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{sold}</Text><Text style={styles.metricLabel}>Продано билетов</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data?.summary.activeEvents ?? 0}</Text><Text style={styles.metricLabel}>Активные события</Text></View>
          </View>
          <View style={officeStyles.card}>
            <Text style={officeStyles.cardTitle}>Общая заполняемость</Text>
            <Text style={styles.bigPercent}>{capacity ? Math.round((sold / capacity) * 100) : 0}%</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0}%` }]} /></View>
            <Text style={officeStyles.cardText}>{sold} из {capacity || 0} доступных билетов</Text>
          </View>
        </>
      )}
    </OfficePage>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  metricCard: { width: "48%", backgroundColor: "white", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#E5E7EB", minHeight: 116 },
  metricValue: { fontSize: 23, fontWeight: "900", color: "#111827" },
  metricLabel: { fontSize: 12.5, lineHeight: 18, color: "#6B7280", marginTop: 8 },
  bigPercent: { fontSize: 34, fontWeight: "900", color: "#111827", marginTop: 14 },
  track: { height: 9, borderRadius: 99, backgroundColor: "#E5E7EB", overflow: "hidden", marginTop: 12 },
  fill: { height: "100%", borderRadius: 99, backgroundColor: "#111827" },
});