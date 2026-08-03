import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";

export default function ScannerScreen() {
  return (
    <OfficePage title="Сканер" subtitle="Контроль входа и проверка QR-кодов билетов.">
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="scan-outline" size={42} color="#111827" />
        </View>
        <Text style={styles.title}>Открыть контроль входа</Text>
        <Text style={styles.text}>Сканер откроется в защищённой версии Atlas и использует камеру телефона.</Text>
        <TouchableOpacity style={officeStyles.button} onPress={() => Linking.openURL("https://www.atlas-one.co/office/scanner")} accessibilityRole="button">
          <Text style={officeStyles.buttonText}>Запустить сканер</Text>
        </TouchableOpacity>
      </View>
    </OfficePage>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: "white", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "stretch" },
  iconWrap: { width: 78, height: 78, borderRadius: 24, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 21, fontWeight: "900", color: "#111827", textAlign: "center" },
  text: { fontSize: 14, lineHeight: 21, color: "#6B7280", textAlign: "center", marginTop: 8, marginBottom: 8 },
});