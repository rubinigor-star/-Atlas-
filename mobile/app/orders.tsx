import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";
import { getDashboard, type DashboardPayload } from "@/lib/api";

function money(minor: number) {
  return new Intl.NumberFormat("ru-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(minor / 100);
}

export default function OrdersScreen() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <OfficePage title="Заказы" subtitle="Последние покупки и текущие статусы заказов.">
      {loading ? <ActivityIndicator size="large" /> : data?.recentOrders.length ? (
        data.recentOrders.map((order) => (
          <View key={order.id} style={officeStyles.card}>
            <View style={officeStyles.row}>
              <Text style={officeStyles.cardTitle}>{order.customerName}</Text>
              <Text style={officeStyles.cardTitle}>{money(order.totalMinor)}</Text>
            </View>
            <Text style={officeStyles.cardText}>{order.event.title}</Text>
            <Text style={officeStyles.cardText}>Заказ {order.publicId} · {order.ticketCount} билетов · {order.status}</Text>
          </View>
        ))
      ) : (
        <View style={officeStyles.empty}>
          <Text style={officeStyles.emptyTitle}>Заказов пока нет</Text>
          <Text style={officeStyles.emptyText}>Новые покупки появятся здесь автоматически.</Text>
        </View>
      )}
    </OfficePage>
  );
}