import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OfficePage, officeStyles } from "@/components/OfficePage";

const SCANNER_URL = "https://www.atlas-one.co/office/scanner";

async function openScanner() {
  const supported = await Linking.canOpenURL(SCANNER_URL);
  if (!supported) {
    throw new Error("SCANNER_URL_NOT_SUPPORTED");
  }
  await Linking.openURL(SCANNER_URL);
}

export default function ScannerScreen() {
  return (
    <OfficePage title="Сканер" subtitle="Контроль входа и проверка QR-кодов билетов.">
      <View style={styles.hero}>
        <TouchableOpacity
          style={styles.iconWrap}
          onPress={() => void openScanner()}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Открыть сканер билетов"
        >
          <Ionicons name="scan-outline" size={42} color="#15803D" />
        </TouchableOpacity>
        <Text style={styles.title}>Открыть контроль входа</Text>
        <Text style={styles.text}>Нажмите на зелёную иконку или кнопку. Сканер откроется в защищённой версии Atlas и использует камеру телефона.</Text>
        <TouchableOpacity
          style={[officeStyles.button, styles.scannerButton]}
          onPress={() => void openScanner()}
          accessibilityRole="button"
          accessibilityLabel="Запустить сканер билетов"
        >
          <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
          <Text style={officeStyles.buttonText}>Запустить сканер</Text>
        </TouchableOpacity>
      </View>
    </OfficePage>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: "white", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "stretch" },
  iconWrap: { width: 78, height: 78, borderRadius: 24, backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 21, fontWeight: "900", color: "#111827", textAlign: "center" },
  text: { fontSize: 14, lineHeight: 21, color: "#6B7280", textAlign: "center", marginTop: 8, marginBottom: 8 },
  scannerButton: { backgroundColor: "#15803D", flexDirection: "row", gap: 8 },
});