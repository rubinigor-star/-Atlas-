import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";
import { getDashboard, logout, type DashboardPayload } from "@/lib/api";

export default function ProfileScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  async function signOut() {
    await logout();
    router.dismissAll();
    router.replace("/");
  }

  return (
    <OfficePage title="Профиль" subtitle="Аккаунт, организация и права доступа.">
      {loading ? <ActivityIndicator size="large" /> : (
        <>
          <View style={officeStyles.card}>
            <Text style={officeStyles.cardTitle}>{data?.user.name || "Atlas User"}</Text>
            <Text style={officeStyles.cardText}>{data?.user.email}</Text>
            <Text style={officeStyles.cardText}>{data?.user.organization?.name || data?.user.jobTitle || "Atlas One"}</Text>
          </View>
          <View style={officeStyles.card}>
            <Text style={officeStyles.cardTitle}>Роль</Text>
            <Text style={officeStyles.cardText}>{data?.user.staffRole || data?.user.role || "Организатор"}</Text>
            <Text style={officeStyles.cardText}>Разрешений: {data?.user.permissions?.length ?? 0}</Text>
          </View>
          <TouchableOpacity style={officeStyles.secondaryButton} onPress={signOut} accessibilityRole="button">
            <Text style={officeStyles.secondaryButtonText}>Выйти из аккаунта</Text>
          </TouchableOpacity>
        </>
      )}
    </OfficePage>
  );
}