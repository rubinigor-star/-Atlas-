import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OfficePage } from "@/components/OfficePage";
import { validateTicket, type TicketValidationPayload } from "@/lib/api";

type ScanState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; payload: TicketValidationPayload }
  | { kind: "error"; message: string };

const RESULT_COPY: Record<TicketValidationPayload["result"], { title: string; message: string; icon: keyof typeof Ionicons.glyphMap }> = {
  VALID: { title: "Билет действителен", message: "Вход подтверждён. Билет отмечен как использованный.", icon: "checkmark-circle" },
  USED: { title: "Билет уже использован", message: "Повторный вход по этому QR-коду запрещён.", icon: "alert-circle" },
  CANCELLED: { title: "Билет отменён", message: "Этот билет недействителен и не может быть пропущен.", icon: "close-circle" },
  NOT_FOUND: { title: "Билет не найден", message: "QR-код не относится к действующему билету Atlas.", icon: "help-circle" },
};

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "SCAN_FAILED";
  if (code === "UNAUTHORIZED") return "Сессия завершена. Вернитесь на главный экран и войдите снова.";
  if (code === "FORBIDDEN") return "У этого сотрудника нет права сканировать билеты.";
  if (code === "EVENT_ACCESS_DENIED") return "Этот билет относится к мероприятию, к которому у вас нет доступа.";
  if (code === "NETWORK_ERROR") return "Нет связи с Atlas. Проверьте интернет и повторите сканирование.";
  if (code === "INVALID_QR") return "QR-код имеет неправильный формат.";
  return "Не удалось проверить билет. Повторите сканирование.";
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const busyRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    busyRef.current = false;
    setPaused(false);
    setState({ kind: "idle" });
  }, []);

  const handleBarcode = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (busyRef.current || paused) return;
    busyRef.current = true;
    setPaused(true);
    setState({ kind: "checking" });

    try {
      const payload = await validateTicket(data);
      setState({ kind: "result", payload });
    } catch (error) {
      const payload = (error as Error & { payload?: TicketValidationPayload }).payload;
      if (payload?.result) setState({ kind: "result", payload });
      else setState({ kind: "error", message: errorMessage(error) });
    }

    resumeTimerRef.current = setTimeout(resume, 2200);
  }, [paused, resume]);

  if (!permission) {
    return (
      <OfficePage title="Сканер" subtitle="Подготовка камеры...">
        <View style={styles.centerCard}><ActivityIndicator size="large" color="#15803D" /></View>
      </OfficePage>
    );
  }

  if (!permission.granted) {
    return (
      <OfficePage title="Сканер" subtitle="Для проверки билетов требуется камера.">
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}><Ionicons name="camera-outline" size={38} color="#15803D" /></View>
          <Text style={styles.permissionTitle}>Разрешите доступ к камере</Text>
          <Text style={styles.permissionText}>Atlas Office использует камеру только для чтения QR-кодов билетов.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void requestPermission()} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Разрешить камеру</Text>
          </TouchableOpacity>
        </View>
      </OfficePage>
    );
  }

  const resultCopy = state.kind === "result" ? RESULT_COPY[state.payload.result] : null;
  const success = state.kind === "result" && state.payload.result === "VALID";

  return (
    <OfficePage title="Сканер" subtitle="Наведите камеру на QR-код билета.">
      <View style={styles.cameraCard}>
        <CameraView
          style={styles.camera}
          facing="back"
          active
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={paused ? undefined : handleBarcode}
        >
          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>СКАНЕР АКТИВЕН</Text></View>
              <TouchableOpacity style={[styles.torchButton, torch && styles.torchButtonActive]} onPress={() => setTorch((value) => !value)} accessibilityRole="button" accessibilityLabel="Включить фонарик">
                <Ionicons name={torch ? "flash" : "flash-outline"} size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.target}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>

            <Text style={styles.hint}>Поместите QR-код внутрь рамки</Text>
          </View>
        </CameraView>
      </View>

      <View style={styles.statusCard}>
        {state.kind === "idle" && (
          <><Ionicons name="scan-outline" size={30} color="#15803D" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>Готов к сканированию</Text><Text style={styles.statusText}>Камера остаётся открытой после каждого билета.</Text></View></>
        )}
        {state.kind === "checking" && (
          <><ActivityIndicator size="small" color="#15803D" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>Проверяем билет...</Text><Text style={styles.statusText}>Не убирайте QR-код до получения результата.</Text></View></>
        )}
        {state.kind === "result" && resultCopy && (
          <><Ionicons name={resultCopy.icon} size={34} color={success ? "#15803D" : "#B91C1C"} /><View style={styles.statusCopy}><Text style={[styles.statusTitle, !success && styles.statusTitleError]}>{resultCopy.title}</Text><Text style={styles.statusText}>{state.payload.holderName ? `${state.payload.holderName} · ${state.payload.categoryName || "Билет"}` : resultCopy.message}</Text>{state.payload.event?.title ? <Text style={styles.eventName}>{state.payload.event.title}</Text> : null}</View></>
        )}
        {state.kind === "error" && (
          <><Ionicons name="warning-outline" size={34} color="#B91C1C" /><View style={styles.statusCopy}><Text style={styles.statusTitleError}>Ошибка проверки</Text><Text style={styles.statusText}>{state.message}</Text></View></>
        )}
      </View>

      {paused && state.kind !== "checking" ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={resume} accessibilityRole="button">
          <Ionicons name="scan-outline" size={19} color="#15803D" />
          <Text style={styles.secondaryButtonText}>Сканировать следующий билет</Text>
        </TouchableOpacity>
      ) : null}
    </OfficePage>
  );
}

const styles = StyleSheet.create({
  centerCard: { minHeight: 280, backgroundColor: "white", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  permissionCard: { backgroundColor: "white", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  permissionIcon: { width: 76, height: 76, borderRadius: 24, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  permissionTitle: { fontSize: 21, fontWeight: "900", color: "#111827", textAlign: "center" },
  permissionText: { fontSize: 14, lineHeight: 21, color: "#6B7280", textAlign: "center", marginTop: 8, marginBottom: 20 },
  primaryButton: { minHeight: 52, width: "100%", borderRadius: 16, backgroundColor: "#15803D", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "white", fontSize: 15, fontWeight: "800" },
  cameraCard: { height: 430, borderRadius: 26, overflow: "hidden", backgroundColor: "#111827", borderWidth: 3, borderColor: "#15803D" },
  camera: { flex: 1 },
  overlay: { flex: 1, padding: 18, justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.12)" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(17,24,39,0.76)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  liveText: { color: "white", fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  torchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(17,24,39,0.76)", alignItems: "center", justifyContent: "center" },
  torchButtonActive: { backgroundColor: "#15803D" },
  target: { width: 240, height: 240, alignSelf: "center" },
  corner: { position: "absolute", width: 52, height: 52, borderColor: "#4ADE80" },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
  hint: { alignSelf: "center", color: "white", fontSize: 13, fontWeight: "800", backgroundColor: "rgba(17,24,39,0.76)", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9, overflow: "hidden" },
  statusCard: { marginTop: 14, minHeight: 94, backgroundColor: "white", borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", padding: 17, flexDirection: "row", alignItems: "center", gap: 14 },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: "900", color: "#15803D" },
  statusTitleError: { fontSize: 16, fontWeight: "900", color: "#B91C1C" },
  statusText: { fontSize: 13, lineHeight: 19, color: "#6B7280", marginTop: 3 },
  eventName: { fontSize: 12, fontWeight: "800", color: "#374151", marginTop: 5 },
  secondaryButton: { minHeight: 50, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: "#86EFAC", backgroundColor: "#F0FDF4", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#15803D", fontSize: 14, fontWeight: "900" },
});
