import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { OfficePage } from "@/components/OfficePage";
import {
  getRecentScans,
  searchScannerAttendees,
  validateTicket,
  type RecentScan,
  type ScannerAttendee,
  type TicketValidationPayload,
} from "@/lib/api";

type ScanState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; payload: TicketValidationPayload }
  | { kind: "error"; message: string };

const OK_TONE = "data:audio/wav;base64,UklGRnQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAFAACAgIKCgX56eHl/houMhnxybnJ9i5WVi3trY2l6j56gkntkWWB1kaaqmn1hU1pykKesnH9jU1hvjaWsnoJlVFdsi6SsoIVnVVZqiKKtoohqVlVnhaCspItsV1Rlgp6spY1vWFNjgJysp5ByWlNhfZqrqJN0W1NfepiqqZV3XVNdd5Wpqph6X1NbdJOoq5p9YVNacpCnrJyAY1NYb42lrJ6CZVRXbIukrKCFZ1VWaoiiraKIalZVZ4WgrKSLbFdUZYKerKWNb1hTY4CcrKeQclpTYX2aq6iTdFtTX3qYqqmVd11TXXeVqaqYel9TW3STqKuafWFTWnKQp6ycf2NTWG+NpayegmVUV2yLpKyghWdVVmqIoq2iiGpWVWeFoKyki2xXVGWCnqyljW9YU2N/nKynkHJaU2F9mquok3RbU196mKqplXddU113lamqmHpfU1t0k6irmn1hU1pykKesnIBjU1hvjaWsnoJlVFdsi6SsoIVnVVZqiKKtoohqVlVnhaCspItsV1Rlgp6spY1vWFNjgJyrpY9yXFdkfZelopB2Ylxme5Kgno95Z2Foeo6amo58bGZreYqVlo1+cWtueYeQkYt/dXByeoSLjIiAeXV2e4KGh4WAfHp7fYCCgoGAf3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIKBfXp7gYiJgndyeIWQjoBwa3eLmJF7Z2V5lKCSdF1hfp6nkGtUYIanqYpjU2aNqqWCXVRtlaygellWdJusmnJVWnyhrJNrU16EpqmMZFNkjKmmhF5Ta5OsoXxaVXKarJt0Vll6oKyVbVRdgqWqjWZTY4qpp4ZgU2qSq6J+W1VxmayddldYeJ+slm5UXICkq49nU2KIqKiHYVNokKujf1xUb5esnnhXV3edrJhwVFt/o6uRaVNgh6eoiWJTZo6qpIFdVG2VrJ95WFZ1nKyZclVafaKrkmpTX4WmqYtkU2WNqqWDXlNslKyhe1lWc5utm3NWWXuhrJRsU16DpaqNZVNki6mmhV9TapKron1aVXKZrJx1Vlh5n6yVbVRdgaSqjmZTYomop4dgU2mRq6N/W1RwmKydd1dXeJ6sl29UXICjq5BoU2GHqKiIYlNnj6ukgFxUbpasn3hYV3adrJlxVVt+oquSalNghqepimNTZo2qpYJdVG2VrKB6WVZ0m6yaclVafKGsk2tTXoSmqYxkU2SMqaaEXlNrk6yhfFpVcpqsm3RWWXqgrJVtVF2CpaqNZlNjiqmnhmBTapKron5bVXGZrJ12V1h4n6yWblRcgKSrj2dTYoioqIdhU2iQq6OAXFRvl6yeeFdXd52smHBUW3+jq5FpU2CHp6iJYlNmjqqkgV1UbZWsn3lYVnWcrJlyVVp9oquSalNfhaapi2RTZY2qpYNeU2yUrKF7WVZzm6yadFdbe56okm5ZYoOfoopqXGqIn5yDaGBxjJ2Wfmhld4+ZkHppa3yPlYp3bHCAj5GFdm91g42MgndzeoSKh394d32DhoR+e3t/goKBf35/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
const ERROR_TONE = "data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICBgoSFh4iKi4uLi4qIhoOAfHl0cGxpZmNhYGBhZGdrcHZ9hIuTmqClqausrKuopJ+Zk4uEfHRtZmBbV1RTU1RWWl9ka3J6gomRmJ6jp6qsrKyppqGclY6Hf3dwaWJdWFVTU1NVWF1iaXB3f4eOlZyhpqmsrKyqp6OemJGJgnpya2RfWlZUU1NUV1tgZm10fISLk5mfpKirrKyrqaWgmpOMhH11bmdhXFdUU1NUVlpeZGpyeYGJkJedo6eqrKysqqainJaPh394cGljXVlVU1NTVVhcYmhvdn6GjZWboaWpq6ysq6ijnpiRioJ7c2xlX1pWVFNTVFdbYGZsdHuDi5KZn6Soq6ysq6mloJuUjYV9dm5nYVxYVVNTU1ZZXmNqcXiAiI+WnaKnqqytrKqnop2Wj4iAeHFqY15ZVlNTU1VYXGFnbnZ9hY2Um6ClqausrKuopJ+ZkouDe3RsZmBbV1RTU1RWWl9lbHN7goqRmJ6jqKusrKuppaGblY2GfnZvaGJcWFVTU1NVWV1jaXB4gIePlpyipqqsrKyqp6Odl5CJgXlyamReWlZUU1NUV1xhZ251fYSMk5qgpamrrKyrqKSfmZOLhHx0bWZgW1dUU1NUVlpfZGtyeoKJkZieo6eqrKysqaahnJWOh393cGliXVhVU1NTVVhdYmlwd3+HjpWcoaaprKysqqejnpiRiYJ6cmtkX1pWVFNTVFdbYGZtdHyEi5OZn6Soq6ysq6mloJqTjIR9dW5nYVxXVFNTVFZaXmRqcnmBiZCXnaOnqqysrKqmopyWj4eAeHBpY11ZVVNTU1VYXGJob3Z+ho2Vm6GlqausrKuoo56YkYqCe3NsZV9aVlRTU1RXW2BmbHR7g4uSmZ+kqKusrKuppaCblI2FfXZuZ2FcWFVTU1NWWV5janF4gIiPlp2ip6qsrayqp6Kdlo+IgHhxamNeWVZTU1NVWF1iaW92foWLkZebn6Kjo6OhnpuXko2Hgn14c29saWdmZmZoaWxvcnZ6fYGEh4qMjY+Pj4+OjIuJh4WDgX9+fHt6enp6enp7fH19fn9/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGCg4WGiImLjI2Ojo6NjIuJhoSAfXl1cW1pZWFfXFpZWVpbXmFlanB2fYOJj5Wbn6OnqqusrKyqp6Sgm5aQioR9d3FrZmFcWVZUU1NTVVdaXmNobnR6gIeNk5idoqWpq6ytrKuppaKdmJONh4B6dG5oY15aV1VTU1NUVllcYWZrcXd9hIqQlpugpKeqrKysq6qno5+blY+Jg312cGplYFxYVlRTU1NVV1tfY2ludHuBh42TmZ6ipqmrrKysq6iloZ2YkoyGf3lzbWdiXlpXVFNTU1RWWV1hZmxyeH6Ei5GWnKCkqKiqrKyrqaWjn5qVj4mCfHZwamRgXFhVVFNTU1VYW19kaW91e4KIjpSZnqOmqausrKyqqKWhnJeRi4V/eHJsZ2JdWlZUU1NTVFZaXWJnbHJ4f4WLkZecoaWoqqysrKuppqOemZSOiIJ7dW9pZF9bWFVTU1NUVVhcYGRqcHZ8gomPlZqfo6epq6ysrKqopKCclpGLhH54cmxmYV1ZVlRTU1NUV1peYmdtc3mAhoySmJ2hpairrKysq6mmop6Zk42HgXt0bmljX1tXVVNTU1RWWFxgZWpwdn2DiY+Vm5+jp6qrrKysqqekoJuWkIqEfXdxa2ZhXFlWVFNTU1VXWl5jaG50eoCHjZOYnaKlqausrayrqaWinZiTjYeAenRuaGNeWldVU1NTVFZZXGFma3F3fYSKkJaboKSnqqysrKuqp6Ofm5WPiYN9dnBqZWBcWFZUU1NTVVdbX2NpbnR7gYeNk5meoqapq6ysrKuopaGdmJKMhoB5c21nYl5aV1RTU1NUVlldYWZscnh+hIuRlpygpKiqrKysq6mno5+alY+Jgnx2cGpkYFxYVVRTU1NVWFtfZGlvdXuCiI6UmZ6jpqmrrKysqqiloZyXkYuFf3hybGdiXVpWVFNTU1RWWl1iZ2xyeH+Fi5GXnKGlqKqsrKyrqaajnpmUjoiCe3VvaWRfW1hVU1NTVFVYXGBkanB2fIKJj5Wan6OnqausrKyqqKSgnJaRi4R+eHJsZmFdWVZUU1NTVFdaXmJnbXN5gIaMkpidoaWoq6ysrKuppqKemZONh4F7dG5pY19bV1VTU1NUVlhcYGVqcHZ9g4mPlZufo6eqq6ysrKqnpKCblpCKhH13cWtmYVxZVlRTU1NVWFtfZGlvdXqAhouQlJibnqChoaGgn52al5SQjIiEgHx5dXJwbmxrampqa2xtb3FzdXh6fX+Bg4SGh4iJiYmJiIiHhoWEg4OCgYCAf39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=";

const RESULT_COPY: Record<TicketValidationPayload["result"], { title: string; message: string; icon: keyof typeof Ionicons.glyphMap }> = {
  VALID: { title: "Вход разрешён", message: "Билет отмечен как использованный.", icon: "checkmark-circle" },
  USED: { title: "Уже использован", message: "Этот билет уже проходил check-in.", icon: "alert-circle" },
  CANCELLED: { title: "Билет недействителен", message: "Отменённый билет нельзя пропустить.", icon: "close-circle" },
  NOT_FOUND: { title: "Билет не найден", message: "Этот QR-код не относится к действующему билету Atlas.", icon: "help-circle" },
};

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "SCAN_FAILED";
  if (code === "UNAUTHORIZED") return "Сессия завершена. Войдите в приложение снова.";
  if (code === "FORBIDDEN") return "У этого сотрудника нет права сканировать билеты.";
  if (code === "EVENT_ACCESS_DENIED") return "Нет доступа к выбранному мероприятию.";
  if (code === "WRONG_EVENT") return "Это билет другого мероприятия. Билет не использован.";
  if (code === "CHECKIN_CLOSED") return "Сканирование для этого мероприятия сейчас закрыто.";
  if (code === "NETWORK_ERROR") return "Нет связи с Atlas. Проверьте интернет и повторите.";
  if (code === "INVALID_QR") return "QR-код имеет неправильный формат.";
  return "Не удалось проверить билет. Повторите сканирование.";
}

function scanLabel(result: string) {
  if (result === "VALID") return "OK";
  if (result === "USED") return "USED";
  if (result === "CANCELLED") return "CANCELLED";
  if (result === "NOT_FOUND") return "NOT FOUND";
  return result;
}

export default function ScannerScreen() {
  const { eventId, eventTitle } = useLocalSearchParams<{ eventId?: string; eventTitle?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ScannerAttendee[]>([]);
  const [searchError, setSearchError] = useState("");
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [manualCheckingId, setManualCheckingId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const okPlayer = useAudioPlayer(OK_TONE);
  const errorPlayer = useAudioPlayer(ERROR_TONE);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  const refreshRecent = useCallback(async () => {
    if (!eventId) return;
    try {
      setRecent((await getRecentScans(eventId)).slice(0, 12));
    } catch {
      // History is supplemental and must never block scanning.
    }
  }, [eventId]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const feedback = useCallback((payload: TicketValidationPayload) => {
    const success = payload.result === "VALID";
    Vibration.vibrate(success ? 80 : [120, 70, 120]);
    if (!soundEnabled) return;
    const player = success ? okPlayer : errorPlayer;
    void player.seekTo(0).then(() => player.play()).catch(() => undefined);
  }, [errorPlayer, okPlayer, soundEnabled]);

  const resume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    busyRef.current = false;
    setPaused(false);
    setState({ kind: "idle" });
  }, []);

  const completeValidation = useCallback((payload: TicketValidationPayload) => {
    setState({ kind: "result", payload });
    feedback(payload);
    void refreshRecent();
  }, [feedback, refreshRecent]);

  const checkCode = useCallback(async (code: string) => {
    if (!eventId) return;
    try {
      const payload = await validateTicket(eventId, code);
      completeValidation(payload);
    } catch (error) {
      const payload = (error as Error & { payload?: TicketValidationPayload }).payload;
      if (payload?.result) completeValidation(payload);
      else {
        setState({ kind: "error", message: errorMessage(error) });
        Vibration.vibrate([120, 70, 120]);
        if (soundEnabled) void errorPlayer.seekTo(0).then(() => errorPlayer.play()).catch(() => undefined);
      }
    }
  }, [completeValidation, errorPlayer, eventId, soundEnabled]);

  const handleBarcode = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (!eventId || busyRef.current || paused) return;
    busyRef.current = true;
    setPaused(true);
    setState({ kind: "checking" });
    await checkCode(data);
    resumeTimerRef.current = setTimeout(resume, 2400);
  }, [checkCode, eventId, paused, resume]);

  const search = useCallback(async () => {
    if (!eventId) return;
    const value = query.trim();
    if (value.length < 2) {
      setSearchError("Введите минимум 2 символа");
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      setSearchResults(await searchScannerAttendees(eventId, value));
    } catch (error) {
      setSearchError(errorMessage(error));
    } finally {
      setSearching(false);
    }
  }, [eventId, query]);

  const manualCheckIn = useCallback(async (attendee: ScannerAttendee) => {
    if (!eventId || !attendee.canCheckIn) return;
    setManualCheckingId(attendee.ticketId);
    setState({ kind: "checking" });
    try {
      await checkCode(attendee.publicCode);
      setSearchResults((items) => items.map((item) => item.ticketId === attendee.ticketId ? { ...item, ticketStatus: "USED", canCheckIn: false } : item));
    } finally {
      setManualCheckingId(null);
    }
  }, [checkCode, eventId]);

  if (!eventId) {
    return (
      <OfficePage title="Сканер" subtitle="Сканер запускается из конкретного мероприятия.">
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}><Ionicons name="calendar-outline" size={38} color="#15803D" /></View>
          <Text style={styles.permissionTitle}>Сначала выберите мероприятие</Text>
          <Text style={styles.permissionText}>Так Atlas не позволит случайно провести билет другого события.</Text>
        </View>
      </OfficePage>
    );
  }

  if (!permission) {
    return <OfficePage title="Сканер" subtitle={eventTitle || "Подготовка камеры..."}><View style={styles.centerCard}><ActivityIndicator size="large" color="#15803D" /></View></OfficePage>;
  }

  if (!permission.granted) {
    return (
      <OfficePage title="Сканер" subtitle={eventTitle || "Для проверки билетов требуется камера."}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}><Ionicons name="camera-outline" size={38} color="#15803D" /></View>
          <Text style={styles.permissionTitle}>Разрешите доступ к камере</Text>
          <Text style={styles.permissionText}>Atlas One использует камеру только для чтения QR-кодов билетов.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void requestPermission()}><Text style={styles.primaryButtonText}>Разрешить камеру</Text></TouchableOpacity>
        </View>
      </OfficePage>
    );
  }

  const resultCopy = state.kind === "result" ? RESULT_COPY[state.payload.result] : null;
  const success = state.kind === "result" && state.payload.result === "VALID";
  const used = state.kind === "result" && state.payload.result === "USED";

  return (
    <OfficePage title="Сканер" subtitle={eventTitle ? `Вход: ${eventTitle}` : "Сканирование мероприятия"}>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.smallAction, soundEnabled && styles.smallActionOn]} onPress={() => setSoundEnabled((value) => !value)}>
          <Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={19} color={soundEnabled ? "#15803D" : "#6B7280"} />
          <Text style={[styles.smallActionText, soundEnabled && styles.smallActionTextOn]}>{soundEnabled ? "Звук" : "Без звука"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallAction, manualOpen && styles.smallActionOn]} onPress={() => setManualOpen((value) => !value)}>
          <Ionicons name="search" size={19} color={manualOpen ? "#15803D" : "#6B7280"} />
          <Text style={[styles.smallActionText, manualOpen && styles.smallActionTextOn]}>Ручной режим</Text>
        </TouchableOpacity>
      </View>

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
              <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>СКАНЕР СОБЫТИЯ</Text></View>
              <TouchableOpacity style={[styles.torchButton, torch && styles.torchButtonActive]} onPress={() => setTorch((value) => !value)}>
                <Ionicons name={torch ? "flash" : "flash-outline"} size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.target}>
              <View style={[styles.corner, styles.cornerTopLeft]} /><View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} /><View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.hint}>QR-код билета Atlas</Text>
          </View>
        </CameraView>
      </View>

      <View style={[styles.statusCard, success && styles.statusSuccess, used && styles.statusUsed, state.kind === "result" && !success && !used && styles.statusError]}>
        {state.kind === "idle" && <><Ionicons name="scan-outline" size={32} color="#15803D" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>Готов к сканированию</Text><Text style={styles.statusText}>Камера остаётся открытой после каждого билета.</Text></View></>}
        {state.kind === "checking" && <><ActivityIndicator size="small" color="#15803D" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>Проверяем билет...</Text><Text style={styles.statusText}>Atlas проверяет билет и право входа.</Text></View></>}
        {state.kind === "result" && resultCopy && <><Ionicons name={resultCopy.icon} size={38} color={success ? "#15803D" : used ? "#B45309" : "#B91C1C"} /><View style={styles.statusCopy}><Text style={[styles.statusTitle, used && styles.statusTitleUsed, !success && !used && styles.statusTitleError]}>{resultCopy.title}</Text><Text style={styles.statusText}>{state.payload.holderName ? `${state.payload.holderName} · ${state.payload.categoryName || "Билет"}` : resultCopy.message}</Text></View></>}
        {state.kind === "error" && <><Ionicons name="warning-outline" size={38} color="#B91C1C" /><View style={styles.statusCopy}><Text style={styles.statusTitleError}>Вход не подтверждён</Text><Text style={styles.statusText}>{state.message}</Text></View></>}
      </View>

      {manualOpen ? (
        <View style={styles.manualCard}>
          <Text style={styles.sectionTitle}>Найти посетителя</Text>
          <Text style={styles.sectionHelp}>Имя, телефон, email или номер заказа</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="054..., email, ATL-..."
              autoCapitalize="none"
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={() => void search()} disabled={searching}>
              {searching ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="search" size={22} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
          {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
          {searchResults.map((item) => (
            <View key={item.ticketId} style={styles.attendeeCard}>
              <View style={styles.attendeeTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attendeeName}>{item.holderName || item.customerName}</Text>
                  <Text style={styles.attendeeMeta}>{item.phone || item.email}</Text>
                  <Text style={styles.attendeeMeta}>{item.orderPublicId} · {item.categoryName}</Text>
                </View>
                <View style={[styles.ticketBadge, item.canCheckIn ? styles.ticketBadgeValid : styles.ticketBadgeUsed]}>
                  <Text style={[styles.ticketBadgeText, !item.canCheckIn && styles.ticketBadgeTextUsed]}>{item.canCheckIn ? "VALID" : item.ticketStatus}</Text>
                </View>
              </View>
              {item.canCheckIn ? (
                <TouchableOpacity style={styles.manualCheckButton} onPress={() => void manualCheckIn(item)} disabled={manualCheckingId === item.ticketId}>
                  {manualCheckingId === item.ticketId ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" /><Text style={styles.manualCheckText}>Подтвердить вход вручную</Text></>}
                </TouchableOpacity>
              ) : <Text style={styles.alreadyUsed}>Вход уже отмечен</Text>}
            </View>
          ))}
          {!searching && query.trim().length >= 2 && searchResults.length === 0 && !searchError ? <Text style={styles.emptyText}>Ничего не найдено</Text> : null}
        </View>
      ) : null}

      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View><Text style={styles.sectionTitle}>Последние сканы</Text><Text style={styles.sectionHelp}>Последние проверки этого мероприятия</Text></View>
          <TouchableOpacity onPress={() => void refreshRecent()}><Ionicons name="refresh" size={22} color="#15803D" /></TouchableOpacity>
        </View>
        {recent.length === 0 ? <Text style={styles.emptyText}>Пока нет сканирований</Text> : recent.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyName}>{item.holderName || item.customerName || "Неизвестный билет"}</Text>
              <Text style={styles.historyMeta}>{new Date(item.scannedAt).toLocaleTimeString("ru-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}{item.categoryName ? ` · ${item.categoryName}` : ""}</Text>
            </View>
            <Text style={[styles.historyResult, item.result === "VALID" ? styles.historyOk : item.result === "USED" ? styles.historyUsed : styles.historyBad]}>{scanLabel(item.result)}</Text>
          </View>
        ))}
      </View>
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
  actionsRow: { flexDirection: "row", gap: 9, marginBottom: 10 },
  smallAction: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF", flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  smallActionOn: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  smallActionText: { color: "#6B7280", fontSize: 13, fontWeight: "800" },
  smallActionTextOn: { color: "#15803D" },
  cameraCard: { height: 390, borderRadius: 26, overflow: "hidden", backgroundColor: "#111827", borderWidth: 3, borderColor: "#15803D" },
  camera: { flex: 1 },
  overlay: { flex: 1, padding: 18, justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.12)" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(17,24,39,0.76)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  liveText: { color: "white", fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  torchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(17,24,39,0.76)", alignItems: "center", justifyContent: "center" },
  torchButtonActive: { backgroundColor: "#15803D" },
  target: { width: 225, height: 225, alignSelf: "center" },
  corner: { position: "absolute", width: 50, height: 50, borderColor: "#4ADE80" },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
  hint: { alignSelf: "center", color: "white", fontSize: 13, fontWeight: "800", backgroundColor: "rgba(17,24,39,0.76)", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9, overflow: "hidden" },
  statusCard: { marginTop: 12, minHeight: 96, backgroundColor: "white", borderRadius: 20, borderWidth: 2, borderColor: "#E5E7EB", padding: 17, flexDirection: "row", alignItems: "center", gap: 14 },
  statusSuccess: { backgroundColor: "#F0FDF4", borderColor: "#22C55E" },
  statusUsed: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
  statusError: { backgroundColor: "#FEF2F2", borderColor: "#EF4444" },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 18, fontWeight: "900", color: "#15803D" },
  statusTitleUsed: { color: "#B45309" },
  statusTitleError: { fontSize: 18, fontWeight: "900", color: "#B91C1C" },
  statusText: { fontSize: 13, lineHeight: 19, color: "#4B5563", marginTop: 3 },
  manualCard: { marginTop: 14, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#111827" },
  sectionHelp: { fontSize: 12.5, color: "#6B7280", marginTop: 3 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  searchInput: { flex: 1, height: 48, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: "#111827", backgroundColor: "#F9FAFB" },
  searchButton: { width: 50, height: 48, borderRadius: 14, backgroundColor: "#15803D", alignItems: "center", justifyContent: "center" },
  searchError: { color: "#B91C1C", fontSize: 13, marginTop: 9 },
  attendeeCard: { marginTop: 10, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 13 },
  attendeeTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  attendeeName: { fontSize: 15, fontWeight: "900", color: "#111827" },
  attendeeMeta: { fontSize: 12.5, color: "#6B7280", marginTop: 3 },
  ticketBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  ticketBadgeValid: { backgroundColor: "#DCFCE7" },
  ticketBadgeUsed: { backgroundColor: "#FEF3C7" },
  ticketBadgeText: { color: "#15803D", fontSize: 10, fontWeight: "900" },
  ticketBadgeTextUsed: { color: "#B45309" },
  manualCheckButton: { height: 43, borderRadius: 13, backgroundColor: "#15803D", marginTop: 11, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  manualCheckText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  alreadyUsed: { marginTop: 9, color: "#B45309", fontSize: 12.5, fontWeight: "800" },
  historyCard: { marginTop: 14, marginBottom: 18, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", padding: 16 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
  historyRow: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  historyName: { fontSize: 13.5, fontWeight: "800", color: "#111827" },
  historyMeta: { fontSize: 11.5, color: "#6B7280", marginTop: 2 },
  historyResult: { fontSize: 10.5, fontWeight: "900", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, overflow: "hidden" },
  historyOk: { color: "#15803D", backgroundColor: "#DCFCE7" },
  historyUsed: { color: "#B45309", backgroundColor: "#FEF3C7" },
  historyBad: { color: "#B91C1C", backgroundColor: "#FEE2E2" },
  emptyText: { color: "#6B7280", fontSize: 13, paddingVertical: 12 },
});
