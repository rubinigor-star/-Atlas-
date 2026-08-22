import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";
import { getDashboard, type DashboardPayload } from "@/lib/api";

export default function RequestsScreen() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <OfficePage title="Заявки" subtitle="Запросы клиентов, ожидающие решения организатора.">
      {loading ? <ActivityIndicator size="large" /> : (
        <>
          <View style={officeStyles.card}>
            <Text style={officeStyles.metric}>{data?.summary.pendingRequests ?? 0}</Text>
            <Text style={officeStyles.label}>Ожидают рассмотрения</Text>
          </View>
          <View style={officeStyles.card}>
            <Text style={officeStyles.cardTitle}>Управление заявками</Text>
            <Text style={officeStyles.cardText}>Полный список заявок с одобрением и отклонением сейчас открывается в защищённом кабинете Atlas.</Text>
            <TouchableOpacity style={officeStyles.button} onPress={() => Linking.openURL("https://www.atlas-one.co/office/requests")} accessibilityRole="button">
              <Text style={officeStyles.buttonText}>Открыть список заявок</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </OfficePage>
  );
}