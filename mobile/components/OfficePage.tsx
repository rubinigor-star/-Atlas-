import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type OfficePageProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function OfficePage({ title, subtitle, children }: OfficePageProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Назад">
          <Ionicons name="arrow-back" size={21} color="#111827" />
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ATLAS OFFICE</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const officeStyles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  cardText: { fontSize: 13, lineHeight: 20, color: "#6B7280", marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metric: { fontSize: 27, fontWeight: "900", color: "#111827" },
  label: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginTop: 4 },
  button: { minHeight: 52, borderRadius: 15, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 10 },
  buttonText: { color: "white", fontSize: 15, fontWeight: "800" },
  secondaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: "white", borderWidth: 1, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 10 },
  secondaryButtonText: { color: "#111827", fontSize: 15, fontWeight: "800" },
  empty: { backgroundColor: "white", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: "#E5E7EB" },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  emptyText: { fontSize: 13, lineHeight: 20, color: "#6B7280", marginTop: 6 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6F8" },
  content: { padding: 20, paddingBottom: 44 },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, minHeight: 42, paddingRight: 12, marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  header: { marginBottom: 22 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: "#6B7280", marginBottom: 7 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: "900", color: "#111827" },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 21, color: "#6B7280" },
});