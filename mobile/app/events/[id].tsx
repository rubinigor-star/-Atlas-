import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeOrderRow } from "@/components/swipe-order-row";
import { getEventOperations, getOrderRefundAvailability, refundEventOrder, resendOrderTicket, reviewEventOrder, type EventOperationOrder, type EventOperationsPayload, type OperationGroup, type RefundAvailability } from "@/lib/api";

const GROUPS: Array<{ key: OperationGroup; label: string }> = [
  { key: "pending", label: "Ожидают" },
  { key: "approved", label: "Подтверждены" },
  { key: "cancelled", label: "Отменены" },
  { key: "abandoned", label: "Брошенные" },
];

function money(minor: number) {
  return new Intl.NumberFormat("ru-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(minor / 100);
}

function eventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(date);
}

function timeAgo(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export default function EventOperationsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<OperationGroup>("pending");
  const [data, setData] = useState<EventOperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EventOperationOrder | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | "resend" | "refund" | null>(null);
  const [refundInfo, setRefundInfo] = useState<RefundAvailability | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  async function load(nextGroup = group, silent = false) {
    if (!id) return;
    if (!silent) setLoading(true);
    try { setData(await getEventOperations(id, nextGroup)); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void load(group); }, [id, group]);

  const orders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.orders || []).filter((order) => !query || `${order.customerName} ${order.customerPhone} ${order.publicId}`.toLowerCase().includes(query));
  }, [data?.orders, search]);

  function closeOrder() {
    if (busyAction) return;
    setSelected(null);
    setRefundInfo(null);
    setRefundAmount("");
    setRefundReason("");
  }

  function closeOrderAfterAction() {
    setSelected(null);
    setRefundInfo(null);
    setRefundAmount("");
    setRefundReason("");
  }

  function confirmReview(action: "approve" | "reject", order: EventOperationOrder | null = selected) {
    if (!order || busyAction) return;
    const approving = action === "approve";
    Alert.alert(
      approving ? "Подтвердить заказ?" : "Отклонить заказ?",
      approving
        ? `С клиента будет завершено списание оплаты и будут выпущены билеты для ${order.customerName}.`
        : `Заявка ${order.customerName} будет отклонена. Предварительная авторизация оплаты будет отменена.`,
      [
        { text: "Назад", style: "cancel" },
        { text: approving ? "Подтвердить" : "Отклонить", style: approving ? "default" : "destructive", onPress: () => void runReview(action, order) },
      ],
    );
  }

  async function runReview(action: "approve" | "reject", order: EventOperationOrder) {
    setBusyAction(action);
    try {
      const result = await reviewEventOrder(order.publicId, action);
      if (selected?.id === order.id) closeOrderAfterAction();
      await load(group, true);
      Alert.alert(
        action === "approve" ? "Заказ подтверждён" : "Заказ отклонён",
        result.emailSent ? "Клиенту отправлено уведомление." : (result.emailError || "Статус заказа обновлён."),
      );
    } catch (error) {
      Alert.alert("Не удалось выполнить действие", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setBusyAction(null);
    }
  }

  async function resendTicket() {
    if (!selected || busyAction) return;
    setBusyAction("resend");
    try {
      const result = await resendOrderTicket(selected.publicId, "email");
      Alert.alert("Билет отправлен", `Email отправлен на ${result.recipient}.`);
    } catch (error) {
      Alert.alert("Не удалось отправить билет", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setBusyAction(null);
    }
  }

  async function openRefund() {
    if (!selected || busyAction) return;
    setBusyAction("refund");
    try {
      const info = await getOrderRefundAvailability(selected.publicId);
      if (!info.canRefund) {
        Alert.alert("Возврат недоступен", info.provider !== "HYP" ? "Для заказа не найдена возвратная транзакция HYP." : "По этому заказу сейчас нет суммы, доступной к возврату.");
        return;
      }
      setRefundInfo(info);
      setRefundAmount((info.refundableMinor / 100).toFixed(2));
      setRefundReason("");
    } catch (error) {
      Alert.alert("Не удалось проверить возврат", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setBusyAction(null);
    }
  }

  function confirmRefund() {
    if (!selected || !refundInfo || busyAction) return;
    const amountMinor = Math.round(Number(refundAmount.replace(",", ".")) * 100);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      Alert.alert("Некорректная сумма", "Укажите сумму возврата больше нуля.");
      return;
    }
    if (amountMinor > refundInfo.refundableMinor) {
      Alert.alert("Сумма слишком большая", `Доступно к возврату ${money(refundInfo.refundableMinor)}.`);
      return;
    }
    if (refundReason.trim().length < 3) {
      Alert.alert("Укажите причину", "Для возврата через HYP нужна причина длиной не менее 3 символов.");
      return;
    }
    const full = amountMinor === refundInfo.refundableMinor;
    Alert.alert(
      full ? "Полный возврат?" : "Частичный возврат?",
      full
        ? `Вернуть ${money(amountMinor)} клиенту? Все билеты заказа будут аннулированы, а места освобождены.`
        : `Вернуть ${money(amountMinor)} клиенту? Билеты останутся действительными.`,
      [
        { text: "Назад", style: "cancel" },
        { text: "Вернуть деньги", style: "destructive", onPress: () => void runRefund(amountMinor) },
      ],
    );
  }

  async function runRefund(amountMinor: number) {
    if (!selected) return;
    setBusyAction("refund");
    try {
      const result = await refundEventOrder(selected.publicId, amountMinor, refundReason.trim());
      const wasFull = Boolean(result.fullRefund);
      closeOrderAfterAction();
      await load(wasFull ? "cancelled" : group, true);
      if (wasFull) setGroup("cancelled");
      Alert.alert("Возврат подтверждён HYP", `${money(result.amountMinor)} возвращено клиенту.${result.emailSent ? " Email об отмене отправлен." : ""}`);
    } catch (error) {
      Alert.alert("Возврат не выполнен", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading && !data) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.center}><Text>Не удалось загрузить мероприятие</Text></SafeAreaView>;

  const totalOrders = Object.values(data.counts).reduce((sum, count) => sum + count, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#17213C" /></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.headerTitle} numberOfLines={2}>{data.event.title}</Text><Text style={styles.headerMeta}>{eventDate(data.event.startsAt)} · {data.event.venue.name}</Text></View>
        <TouchableOpacity style={styles.iconButton} onPress={() => Linking.openURL(`https://www.atlas-one.co/events/${data.event.id}`)}><Ionicons name="ellipsis-horizontal" size={22} color="#17213C" /></TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <View><Text style={styles.summaryValue}>{totalOrders}</Text><Text style={styles.summaryLabel}>заказов</Text></View>
        <View><Text style={styles.summaryValue}>{money(data.event.revenueMinor)}</Text><Text style={styles.summaryLabel}>выручка</Text></View>
        <View><Text style={styles.summaryValue}>{data.event.checkedIn}</Text><Text style={styles.summaryLabel}>пришли</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {GROUPS.map((item) => {
          const active = group === item.key;
          return <TouchableOpacity key={item.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setGroup(item.key)}><Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text><Text style={[styles.tabCount, active && styles.tabTextActive]}>{data.counts[item.key]}</Text></TouchableOpacity>;
        })}
      </ScrollView>

      <View style={styles.searchRow}><View style={styles.searchBox}><Ionicons name="search" size={19} color="#7B8498" /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Имя, телефон или № заказа" /></View><TouchableOpacity style={styles.filterButton}><Ionicons name="options-outline" size={20} color="#17213C" /></TouchableOpacity></View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(group, true); }} />}>
        {orders.map((order) => (
          <SwipeOrderRow key={order.id} enabled={group === "pending" && !busyAction} onApprove={() => confirmReview("approve", order)} onReject={() => confirmReview("reject", order)}>
            <TouchableOpacity style={styles.orderRow} activeOpacity={0.75} onPress={() => { setSelected(order); setRefundInfo(null); }}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{order.customerName.trim().slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.orderMain}><Text style={styles.customerName} numberOfLines={1}>{order.customerName}</Text><Text style={styles.orderMeta} numberOfLines={1}>{order.ticketCount} бил. · {order.categories.map((c) => c.name).join(", ") || "Билет"}</Text><Text style={styles.phone}>{order.customerPhone}</Text></View>
              <View style={styles.orderEnd}><Text style={styles.amount}>{money(order.totalMinor)}</Text><Text style={styles.age}>{timeAgo(order.createdAt)}</Text><Ionicons name="chevron-forward" size={17} color="#A0A7B5" /></View>
            </TouchableOpacity>
          </SwipeOrderRow>
        ))}
        {!orders.length && <View style={styles.empty}><Text style={styles.emptyTitle}>Список пуст</Text><Text style={styles.emptyText}>В этой категории сейчас нет заказов.</Text></View>}
      </ScrollView>

      <TouchableOpacity style={styles.scannerButton} onPress={() => router.push({ pathname: "/scanner", params: { eventId: data.event.id, eventTitle: data.event.title } })}><Ionicons name="scan-outline" size={20} color="#fff" /><Text style={styles.scannerText}>Сканер</Text></TouchableOpacity>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeOrder}>
        <View style={styles.modalRoot}><TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeOrder} /><View style={styles.sheet}>{selected && <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{selected.customerName}</Text><Text style={styles.sheetId}>#{selected.publicId}</Text></View><TouchableOpacity disabled={!!busyAction} onPress={closeOrder}><Ionicons name="close" size={25} color="#17213C" /></TouchableOpacity></View>
          <View style={styles.contactRow}><TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`tel:${selected.customerPhone}`)}><Ionicons name="call-outline" size={20} color="#17213C" /><Text style={styles.contactText}>Позвонить</Text></TouchableOpacity><TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`https://wa.me/${selected.customerPhone.replace(/\D/g, "")}`)}><Ionicons name="logo-whatsapp" size={20} color="#168044" /><Text style={styles.contactText}>WhatsApp</Text></TouchableOpacity><TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`mailto:${selected.customerEmail}`)}><Ionicons name="mail-outline" size={20} color="#17213C" /><Text style={styles.contactText}>Email</Text></TouchableOpacity></View>
          <View style={styles.detailCard}><Detail label="Телефон" value={selected.customerPhone} /><Detail label="Email" value={selected.customerEmail} /><Detail label="Билеты" value={`${selected.ticketCount}`} /><Detail label="Сумма" value={money(selected.totalMinor)} /><Detail label="Статус" value={selected.status} /><Detail label="Создан" value={eventDate(selected.createdAt)} /></View>
          {group === "pending" && <View style={styles.reviewActions}>
            <TouchableOpacity disabled={!!busyAction} style={[styles.reviewButton, styles.rejectButton]} onPress={() => confirmReview("reject")}><Ionicons name="close-circle-outline" size={21} color="#B42318" /><Text style={styles.rejectText}>{busyAction === "reject" ? "Отклоняем..." : "Отклонить"}</Text></TouchableOpacity>
            <TouchableOpacity disabled={!!busyAction} style={[styles.reviewButton, styles.approveButton]} onPress={() => confirmReview("approve")}><Ionicons name="checkmark-circle-outline" size={21} color="#fff" /><Text style={styles.approveText}>{busyAction === "approve" ? "Подтверждаем..." : "Подтвердить"}</Text></TouchableOpacity>
          </View>}
          {group === "approved" && <>
            <TouchableOpacity disabled={!!busyAction} style={styles.resendButton} onPress={() => void resendTicket()}><Ionicons name="mail-unread-outline" size={20} color="#17213C" /><Text style={styles.resendText}>{busyAction === "resend" ? "Отправляем..." : "Отправить билет повторно"}</Text></TouchableOpacity>
            {!refundInfo && <TouchableOpacity disabled={!!busyAction} style={styles.refundButton} onPress={() => void openRefund()}><Ionicons name="return-down-back-outline" size={20} color="#B42318" /><Text style={styles.refundText}>{busyAction === "refund" ? "Проверяем..." : "Вернуть деньги"}</Text></TouchableOpacity>}
            {refundInfo && <View style={styles.refundPanel}>
              <View style={styles.refundHeader}><View><Text style={styles.refundTitle}>Возврат через HYP</Text><Text style={styles.refundAvailable}>Доступно: {money(refundInfo.refundableMinor)}</Text></View><TouchableOpacity onPress={() => setRefundInfo(null)}><Ionicons name="close-circle" size={24} color="#7B8498" /></TouchableOpacity></View>
              <Text style={styles.fieldLabel}>Сумма возврата, ₪</Text>
              <TextInput value={refundAmount} onChangeText={setRefundAmount} keyboardType="decimal-pad" style={styles.refundInput} placeholder="0.00" />
              <Text style={styles.fieldLabel}>Причина</Text>
              <TextInput value={refundReason} onChangeText={setRefundReason} style={[styles.refundInput, styles.reasonInput]} placeholder="Например: мероприятие отменено" multiline />
              <Text style={styles.refundHint}>Полный возврат аннулирует все билеты заказа и освобождает места. При частичном возврате билеты остаются действительными.</Text>
              <TouchableOpacity disabled={!!busyAction} style={styles.refundConfirm} onPress={confirmRefund}><Text style={styles.refundConfirmText}>{busyAction === "refund" ? "Отправляем в HYP..." : "Продолжить возврат"}</Text></TouchableOpacity>
            </View>}
          </>}
        </ScrollView>}</View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue} numberOfLines={1}>{value || "-"}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 76, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#ECEEF3" }, iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, alignItems: "center", paddingHorizontal: 6 }, headerTitle: { fontSize: 17, lineHeight: 21, fontWeight: "900", color: "#17213C", textAlign: "center" }, headerMeta: { fontSize: 11.5, color: "#7B8498", marginTop: 4 },
  summary: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#ECEEF3" }, summaryValue: { fontSize: 18, fontWeight: "900", color: "#17213C", textAlign: "center" }, summaryLabel: { fontSize: 10.5, color: "#8B93A3", marginTop: 3, textAlign: "center" },
  tabsScroll: { maxHeight: 66, backgroundColor: "#fff" }, tabs: { paddingHorizontal: 10, alignItems: "stretch" }, tab: { minWidth: 92, paddingHorizontal: 11, paddingVertical: 11, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" }, tabActive: { borderBottomColor: "#6D45FF" }, tabText: { fontSize: 12, fontWeight: "700", color: "#737C90" }, tabTextActive: { color: "#6D45FF" }, tabCount: { fontSize: 11, color: "#9AA1B0", marginTop: 3 },
  searchRow: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: "#F5F6FA" }, searchBox: { flex: 1, height: 46, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E5EC", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13 }, searchInput: { flex: 1, fontSize: 14 }, filterButton: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E5EC", alignItems: "center", justifyContent: "center" },
  list: { flex: 1 }, listContent: { paddingHorizontal: 10, paddingBottom: 90 }, orderRow: { minHeight: 78, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF3", paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center" }, avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#071536", alignItems: "center", justifyContent: "center", marginRight: 11 }, avatarText: { color: "#fff", fontSize: 17, fontWeight: "900" }, orderMain: { flex: 1 }, customerName: { fontSize: 14.5, fontWeight: "800", color: "#17213C" }, orderMeta: { fontSize: 11.5, color: "#737C90", marginTop: 3 }, phone: { fontSize: 11.5, color: "#60708A", marginTop: 2 }, orderEnd: { alignItems: "flex-end", minWidth: 72 }, amount: { fontSize: 13.5, fontWeight: "900", color: "#17213C" }, age: { fontSize: 10, color: "#9AA1B0", marginTop: 5, marginBottom: 2 }, empty: { padding: 42, alignItems: "center" }, emptyTitle: { fontSize: 17, fontWeight: "900", color: "#17213C" }, emptyText: { color: "#8A92A3", marginTop: 6 },
  scannerButton: { position: "absolute", bottom: 18, alignSelf: "center", height: 48, borderRadius: 24, paddingHorizontal: 22, backgroundColor: "#071536", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, scannerText: { color: "#fff", fontWeight: "800" },
  modalRoot: { flex: 1, justifyContent: "flex-end" }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,12,32,.45)" }, sheet: { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 34, maxHeight: "82%" }, handle: { width: 44, height: 5, borderRadius: 99, backgroundColor: "#D7DBE4", alignSelf: "center", marginBottom: 16 }, sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, sheetTitle: { fontSize: 22, fontWeight: "900", color: "#17213C" }, sheetId: { fontSize: 11.5, color: "#8A92A3", marginTop: 3 }, contactRow: { flexDirection: "row", gap: 8, marginTop: 16 }, contactButton: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#E2E5EC", alignItems: "center", justifyContent: "center" }, contactText: { fontSize: 10.5, marginTop: 3, color: "#17213C", fontWeight: "700" }, detailCard: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#ECEEF3" }, detailRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#F0F1F4" }, detailLabel: { fontSize: 12, color: "#8A92A3" }, detailValue: { maxWidth: "66%", fontSize: 12.5, fontWeight: "700", color: "#17213C" }, reviewActions: { flexDirection: "row", gap: 10, marginTop: 16 }, reviewButton: { flex: 1, height: 52, borderRadius: 15, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" }, rejectButton: { borderWidth: 1, borderColor: "#F1B8B2", backgroundColor: "#FFF7F6" }, approveButton: { backgroundColor: "#168044" }, rejectText: { color: "#B42318", fontWeight: "900" }, approveText: { color: "#fff", fontWeight: "900" }, resendButton: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: "#DDE1EA", backgroundColor: "#fff", marginTop: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, resendText: { color: "#17213C", fontWeight: "800" }, refundButton: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: "#F1B8B2", backgroundColor: "#FFF7F6", marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, refundText: { color: "#B42318", fontWeight: "900" }, refundPanel: { marginTop: 12, borderWidth: 1, borderColor: "#F1B8B2", backgroundColor: "#FFF9F8", borderRadius: 16, padding: 14 }, refundHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }, refundTitle: { fontSize: 16, fontWeight: "900", color: "#B42318" }, refundAvailable: { marginTop: 3, fontSize: 11.5, color: "#7B8498" }, fieldLabel: { fontSize: 11.5, fontWeight: "700", color: "#5E6676", marginBottom: 6, marginTop: 8 }, refundInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#DDE1EA", backgroundColor: "#fff", paddingHorizontal: 12, fontSize: 14, color: "#17213C" }, reasonInput: { minHeight: 70, paddingTop: 11, textAlignVertical: "top" }, refundHint: { fontSize: 10.5, lineHeight: 15, color: "#7B8498", marginTop: 10 }, refundConfirm: { height: 48, borderRadius: 13, backgroundColor: "#B42318", alignItems: "center", justifyContent: "center", marginTop: 12 }, refundConfirmText: { color: "#fff", fontWeight: "900" },
});
