import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeOrderRow } from "@/components/swipe-order-row";
import {
  getEventOperations,
  getOrderRefundAvailability,
  refundEventOrder,
  resendOrderTicket,
  reviewEventOrder,
  type EventOperationOrder,
  type EventOperationsPayload,
  type OperationGroup,
  type OperationSort,
  type RefundAvailability,
} from "@/lib/api";

const GROUPS: Array<{ key: OperationGroup; label: string }> = [
  { key: "pending", label: "Ожидают" },
  { key: "approved", label: "Подтверждены" },
  { key: "cancelled", label: "Отменены" },
  { key: "abandoned", label: "Брошенные" },
];

const SORT_OPTIONS: Array<{ key: OperationSort; label: string }> = [
  { key: "newest", label: "Сначала новые" },
  { key: "oldest", label: "Сначала старые" },
  { key: "amount_desc", label: "Сумма: больше сначала" },
  { key: "amount_asc", label: "Сумма: меньше сначала" },
];

function money(minor: number) {
  return new Intl.NumberFormat("ru-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function eventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(date);
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

function ageFromBirthDate(value?: string | null) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function attributionIcon(kind?: string | null): React.ComponentProps<typeof Ionicons>["name"] {
  if (kind === "PROMOTER") return "people-outline";
  if (kind === "REFERRAL") return "link-outline";
  return "navigate-outline";
}

export default function EventOperationsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<OperationGroup>("pending");
  const [data, setData] = useState<EventOperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EventOperationOrder | null>(null);
  const [processingReviewIds, setProcessingReviewIds] = useState<Set<string>>(() => new Set());
  const [busyAction, setBusyAction] = useState<"resend" | "refund" | null>(null);
  const [refundInfo, setRefundInfo] = useState<RefundAvailability | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<OperationSort>("newest");

  async function load(nextGroup = group, silent = false, page = 1, append = false) {
    if (!id) return;
    if (!silent && page === 1) setLoading(true);
    try {
      const result = await getEventOperations(id, nextGroup, {
        page,
        limit: 50,
        search,
        category: categoryFilter,
        sort: sortMode,
      });
      setData((current) => append && current
        ? { ...result, orders: [...current.orders, ...result.orders] }
        : result);
    } catch (error) {
      if (!silent) Alert.alert("Не удалось загрузить данные", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(group); }, 250);
    return () => clearTimeout(timer);
  }, [id, group, search, categoryFilter, sortMode]);

  async function loadMore() {
    if (!data?.pagination.hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    await load(group, true, data.pagination.page + 1, true);
  }

  function resetOrderState() {
    setSelected(null);
    setRefundInfo(null);
    setRefundAmount("");
    setRefundReason("");
  }

  function resetFilters() {
    setCategoryFilter("all");
    setSortMode("newest");
  }

  function setReviewProcessing(orderId: string, active: boolean) {
    setProcessingReviewIds((current) => {
      const next = new Set(current);
      if (active) next.add(orderId); else next.delete(orderId);
      return next;
    });
  }

  function confirmReview(action: "approve" | "reject", order: EventOperationOrder | null = selected) {
    if (!order || busyAction || processingReviewIds.has(order.id)) return;
    if (action === "approve" && !order.canApprove) {
      Alert.alert("Подтверждение недоступно", order.reviewBlockedReason || "Оплата не готова к подтверждению.");
      return;
    }
    if (action === "reject" && !order.canReject) {
      Alert.alert("Отклонение недоступно", order.reviewBlockedReason || "Эту заявку нельзя отклонить из приложения.");
      return;
    }
    const approving = action === "approve";
    Alert.alert(
      approving ? "Подтвердить заказ?" : "Отклонить заказ?",
      approving
        ? `С клиента будет завершено списание оплаты и будут выпущены билеты для ${order.customerName}.`
        : `Заявка ${order.customerName} будет отклонена. Авторизация оплаты будет отменена без списания.`,
      [
        { text: "Назад", style: "cancel" },
        { text: approving ? "Подтвердить" : "Отклонить", style: approving ? "default" : "destructive", onPress: () => void runReview(action, order) },
      ],
    );
  }

  async function runReview(action: "approve" | "reject", order: EventOperationOrder) {
    if (processingReviewIds.has(order.id)) return;
    setReviewProcessing(order.id, true);
    if (selected?.id === order.id) resetOrderState();

    setData((current) => {
      if (!current) return current;
      const wasVisiblePending = group === "pending" && current.orders.some((item) => item.id === order.id);
      return {
        ...current,
        counts: wasVisiblePending
          ? { ...current.counts, pending: Math.max(0, current.counts.pending - 1) }
          : current.counts,
        orders: current.orders.filter((item) => item.id !== order.id),
      };
    });

    try {
      await reviewEventOrder(order.publicId, action);
      await load(group, true);
    } catch (error) {
      await load(group, true);
      Alert.alert(
        action === "approve" ? "Не удалось подтвердить заявку" : "Не удалось отклонить заявку",
        `${order.customerName}: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
      );
    } finally {
      setReviewProcessing(order.id, false);
    }
  }

  function confirmResend(order: EventOperationOrder | null = selected) {
    if (!order || busyAction || order.source !== "ORDER") return;
    Alert.alert(
      "Отправить билет повторно?",
      `Билет заказа #${order.publicId} будет повторно отправлен на ${order.customerEmail}.`,
      [
        { text: "Назад", style: "cancel" },
        { text: "Отправить", onPress: () => void resendTicket(order) },
      ],
    );
  }

  async function resendTicket(order: EventOperationOrder) {
    setBusyAction("resend");
    try {
      const result = await resendOrderTicket(order.publicId, "email");
      Alert.alert("Билет отправлен", `Email отправлен на ${result.recipient}.`);
    } catch (error) {
      Alert.alert("Не удалось отправить билет", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setBusyAction(null);
    }
  }

  async function openRefund() {
    if (!selected || busyAction || selected.source !== "ORDER") return;
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
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) return Alert.alert("Некорректная сумма", "Укажите сумму возврата больше нуля.");
    if (amountMinor > refundInfo.refundableMinor) return Alert.alert("Сумма слишком большая", `Доступно к возврату ${money(refundInfo.refundableMinor)}.`);
    if (refundReason.trim().length < 3) return Alert.alert("Укажите причину", "Для возврата через HYP нужна причина длиной не менее 3 символов.");
    const full = amountMinor === refundInfo.refundableMinor;
    Alert.alert(
      full ? "Полный возврат?" : "Частичный возврат?",
      full ? `Вернуть ${money(amountMinor)} клиенту? Все билеты заказа будут аннулированы, а места освобождены.` : `Вернуть ${money(amountMinor)} клиенту? Билеты останутся действительными.`,
      [{ text: "Назад", style: "cancel" }, { text: "Вернуть деньги", style: "destructive", onPress: () => void runRefund(amountMinor) }],
    );
  }

  async function runRefund(amountMinor: number) {
    if (!selected) return;
    setBusyAction("refund");
    try {
      const result = await refundEventOrder(selected.publicId, amountMinor, refundReason.trim());
      const wasFull = Boolean(result.fullRefund);
      resetOrderState();
      if (wasFull) setGroup("cancelled");
      else await load(group, true);
      Alert.alert("Возврат подтверждён HYP", `${money(result.amountMinor)} возвращено клиенту.${result.emailSent ? " Email об отмене отправлен." : ""}`);
    } catch (error) {
      Alert.alert("Возврат не выполнен", error instanceof Error ? error.message : "Неизвестная ошибка");
    } finally {
      setBusyAction(null);
    }
  }

  function renderOrder({ item: order }: { item: EventOperationOrder }) {
    const pending = group === "pending";
    const approved = group === "approved";
    const blocked = pending && !order.canApprove;
    const reviewProcessing = processingReviewIds.has(order.id);
    const age = ageFromBirthDate(order.customerBirthDate);
    const ticketLabel = order.categories.map((item) => item.name).filter(Boolean).join(", ") || "Билет";

    const rightSwipe = pending
      ? (order.canApprove ? { label: "Подтвердить", icon: "checkmark-circle" as const, backgroundColor: "#168044", onPress: () => void runReview("approve", order) } : null)
      : approved
        ? { label: "WhatsApp", icon: "logo-whatsapp" as const, backgroundColor: "#168044", onPress: () => order.customerPhone && void Linking.openURL(whatsappUrl(order.customerPhone)) }
        : null;
    const leftSwipe = pending
      ? (order.canReject ? { label: "Отклонить", icon: "close-circle" as const, backgroundColor: "#B42318", onPress: () => void runReview("reject", order) } : null)
      : approved
        ? { label: "Билет", icon: "mail-unread" as const, backgroundColor: "#17213C", onPress: () => confirmResend(order) }
        : null;

    return (
      <View style={styles.orderCardWrap}>
        <SwipeOrderRow enabled={!busyAction && !reviewProcessing} rightSwipe={rightSwipe} leftSwipe={leftSwipe}>
          <TouchableOpacity style={styles.orderCard} activeOpacity={0.82} onPress={() => { setSelected(order); setRefundInfo(null); }}>
            <View style={[styles.avatar, order.source === "ABANDONED_CHECKOUT" && styles.avatarLost]}>
              {order.socialProfileImageUrl
                ? <Image source={{ uri: order.socialProfileImageUrl }} style={styles.avatarImage} />
                : <Ionicons name={order.source === "ABANDONED_CHECKOUT" ? "cart-outline" : "person-outline"} size={27} color="#17213C" />}
            </View>

            <View style={styles.orderCardBody}>
              <View style={styles.orderCardTop}>
                <View style={styles.orderIdentity}>
                  <View style={styles.nameLine}>
                    <Text style={styles.customerName} numberOfLines={1}>{order.customerName}</Text>
                    {order.source === "ABANDONED_CHECKOUT" && <View style={styles.lostBadge}><Text style={styles.lostBadgeText}>Брошено</Text></View>}
                  </View>
                  {age !== null && <Text style={styles.personMeta}>{age} лет</Text>}
                  {!!order.customerPhone && <Text style={styles.phone}>{order.customerPhone}</Text>}
                  {(order.customerInstagram || order.customerFacebook) && <View style={styles.socialRow}>
                    {!!order.customerInstagram && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerInstagram!)}><Ionicons name="logo-instagram" size={14} color="#C13584" /><Text style={styles.socialChipText}>Instagram</Text></TouchableOpacity>}
                    {!!order.customerFacebook && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerFacebook!)}><Ionicons name="logo-facebook" size={14} color="#1877F2" /><Text style={styles.socialChipText}>Facebook</Text></TouchableOpacity>}
                  </View>}
                </View>
                <View style={styles.orderEnd}>
                  <Text style={styles.amount}>{money(order.totalMinor)}</Text>
                  <Text style={styles.age}>{timeAgo(order.createdAt)}</Text>
                  <Ionicons name="chevron-forward" size={17} color="#A0A7B5" />
                </View>
              </View>

              {order.attribution && order.source === "ORDER" && (
                <View style={styles.attributionBadge}>
                  <Ionicons name={attributionIcon(order.attribution.kind)} size={15} color="#6D45FF" />
                  <View style={styles.attributionCopy}>
                    <Text style={styles.attributionLabel} numberOfLines={1}>{order.attribution.label}</Text>
                    {!!order.attribution.detail && <Text style={styles.attributionDetail} numberOfLines={1}>{order.attribution.detail}</Text>}
                  </View>
                </View>
              )}

              <View style={styles.ticketStrip}>
                <Ionicons name="ticket-outline" size={17} color="#6D45FF" />
                <Text style={styles.ticketType} numberOfLines={1}>{ticketLabel}</Text>
                <View style={styles.ticketCountPill}><Text style={styles.ticketCountText}>{order.ticketCount} {order.ticketCount === 1 ? "билет" : "бил."}</Text></View>
              </View>

              {blocked && <Text style={styles.blockedText} numberOfLines={2}>{order.reviewBlockedReason}</Text>}
            </View>
          </TouchableOpacity>
        </SwipeOrderRow>
      </View>
    );
  }

  if (loading && !data) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.center}><Text>Не удалось загрузить мероприятие</Text></SafeAreaView>;

  const totalOrders = data.counts.pending + data.counts.approved + data.counts.cancelled;
  const hasActiveFilters = categoryFilter !== "all" || sortMode !== "newest";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#17213C" /></TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={2}>{data.event.title}</Text>
          <Text style={styles.headerMeta}>{eventDate(data.event.startsAt)} · {data.event.venue.name}</Text>
        </View>
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
          return (
            <TouchableOpacity key={item.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setGroup(item.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              <Text style={[styles.tabCount, active && styles.tabTextActive]}>{data.counts[item.key]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}><Ionicons name="search" size={19} color="#7B8498" /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Имя, телефон, email или № заказа" /></View>
        <TouchableOpacity style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]} onPress={() => setFilterOpen(true)}><Ionicons name="options-outline" size={20} color={hasActiveFilters ? "#fff" : "#17213C"} /></TouchableOpacity>
      </View>

      {group === "pending" && data.orders.length > 0 && (
        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintApprove}>← Подтвердить</Text>
          <Text style={styles.swipeHintDot}>·</Text>
          <Text style={styles.swipeHintReject}>Отклонить →</Text>
        </View>
      )}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data.orders}
        keyExtractor={(order) => order.id}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(group, true); }} />}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={loadingMore ? <View style={styles.listLoader}><ActivityIndicator /></View> : null}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Ничего не найдено</Text><Text style={styles.emptyText}>Попробуйте изменить поиск или фильтры.</Text></View>}
      />

      <TouchableOpacity style={styles.scannerButton} onPress={() => router.push({ pathname: "/scanner", params: { eventId: data.event.id, eventTitle: data.event.title } })}><Ionicons name="scan-outline" size={20} color="#fff" /><Text style={styles.scannerText}>Сканер</Text></TouchableOpacity>

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalRoot}><TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setFilterOpen(false)} /><View style={styles.filterSheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Фильтр заказов</Text><TouchableOpacity onPress={() => setFilterOpen(false)}><Ionicons name="close" size={25} color="#17213C" /></TouchableOpacity></View>
          <Text style={styles.filterSectionTitle}>Сортировка</Text>
          <View style={styles.chipWrap}>{SORT_OPTIONS.map((option) => <FilterChip key={option.key} label={option.label} active={sortMode === option.key} onPress={() => setSortMode(option.key)} />)}</View>
          {!!data.event.categoryOptions.length && <><Text style={styles.filterSectionTitle}>Категория билета</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}><FilterChip label="Все" active={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />{data.event.categoryOptions.map((name) => <FilterChip key={name} label={name} active={categoryFilter === name} onPress={() => setCategoryFilter(name)} />)}</ScrollView></>}
          <View style={styles.filterFooter}><TouchableOpacity style={styles.resetButton} onPress={resetFilters}><Text style={styles.resetButtonText}>Сбросить</Text></TouchableOpacity><TouchableOpacity style={styles.applyButton} onPress={() => setFilterOpen(false)}><Text style={styles.applyButtonText}>Готово</Text></TouchableOpacity></View>
        </View></View>
      </Modal>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => !busyAction && resetOrderState()}>
        <View style={styles.modalRoot}><TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => !busyAction && resetOrderState()} /><View style={styles.sheet}>{selected && <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetIdentity}>
              {selected.socialProfileImageUrl
                ? <Image source={{ uri: selected.socialProfileImageUrl }} style={styles.sheetAvatar} />
                : <View style={styles.sheetAvatarFallback}><Ionicons name="person-outline" size={24} color="#17213C" /></View>}
              <View><Text style={styles.sheetTitle}>{selected.customerName}</Text><Text style={styles.sheetId}>{selected.source === "ABANDONED_CHECKOUT" ? "Брошенное оформление" : `#${selected.publicId}`}</Text></View>
            </View>
            <TouchableOpacity disabled={!!busyAction} onPress={resetOrderState}><Ionicons name="close" size={25} color="#17213C" /></TouchableOpacity>
          </View>
          <View style={styles.contactRow}>
            {!!selected.customerPhone && <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`tel:${selected.customerPhone}`)}><Ionicons name="call-outline" size={20} color="#17213C" /><Text style={styles.contactText}>Позвонить</Text></TouchableOpacity>}
            {!!selected.customerPhone && <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(whatsappUrl(selected.customerPhone))}><Ionicons name="logo-whatsapp" size={20} color="#168044" /><Text style={styles.contactText}>WhatsApp</Text></TouchableOpacity>}
            {!!selected.customerEmail && <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`mailto:${selected.customerEmail}`)}><Ionicons name="mail-outline" size={20} color="#17213C" /><Text style={styles.contactText}>Email</Text></TouchableOpacity>}
          </View>
          {(selected.customerInstagram || selected.customerFacebook) && <View style={styles.profileLinks}>
            {!!selected.customerInstagram && <TouchableOpacity style={styles.profileLinkButton} onPress={() => void Linking.openURL(selected.customerInstagram!)}><Ionicons name="logo-instagram" size={19} color="#C13584" /><Text style={styles.profileLinkText}>Открыть Instagram</Text></TouchableOpacity>}
            {!!selected.customerFacebook && <TouchableOpacity style={styles.profileLinkButton} onPress={() => void Linking.openURL(selected.customerFacebook!)}><Ionicons name="logo-facebook" size={19} color="#1877F2" /><Text style={styles.profileLinkText}>Открыть Facebook</Text></TouchableOpacity>}
          </View>}
          <View style={styles.detailCard}>
            {!!selected.customerPhone && <Detail label="Телефон" value={selected.customerPhone} />}
            {!!selected.customerEmail && <Detail label="Email" value={selected.customerEmail} />}
            {selected.customerBirthDate && <Detail label="Возраст" value={`${ageFromBirthDate(selected.customerBirthDate) ?? "-"}`} />}
            {selected.attribution && <Detail label="Источник" value={selected.attribution.detail ? `${selected.attribution.label} · ${selected.attribution.detail}` : selected.attribution.label} />}
            <Detail label="Билеты" value={`${selected.ticketCount}`} />
            <Detail label="Сумма" value={money(selected.totalMinor)} />
            <Detail label="Статус" value={selected.status} />
            <Detail label={selected.source === "ABANDONED_CHECKOUT" ? "Последняя активность" : "Создан"} value={eventDate(selected.createdAt)} />
          </View>

          {group === "pending" && <>
            {selected.reviewBlockedReason && !selected.canApprove && <View style={styles.warningBox}><Ionicons name="warning-outline" size={20} color="#B54708" /><Text style={styles.warningText}>{selected.reviewBlockedReason}</Text></View>}
            <View style={styles.reviewActions}>
              <TouchableOpacity disabled={!!busyAction || processingReviewIds.has(selected.id) || !selected.canReject} style={[styles.reviewButton, styles.rejectButton, !selected.canReject && styles.disabledButton]} onPress={() => confirmReview("reject")}><Ionicons name="close-circle-outline" size={21} color="#B42318" /><Text style={styles.rejectText}>Отклонить</Text></TouchableOpacity>
              <TouchableOpacity disabled={!!busyAction || processingReviewIds.has(selected.id) || !selected.canApprove} style={[styles.reviewButton, styles.approveButton, !selected.canApprove && styles.disabledApprove]} onPress={() => confirmReview("approve")}><Ionicons name="checkmark-circle-outline" size={21} color="#fff" /><Text style={styles.approveText}>Подтвердить</Text></TouchableOpacity>
            </View>
          </>}

          {group === "approved" && selected.source === "ORDER" && <>
            <TouchableOpacity disabled={!!busyAction} style={styles.resendButton} onPress={() => confirmResend()}><Ionicons name="mail-unread-outline" size={20} color="#17213C" /><Text style={styles.resendText}>{busyAction === "resend" ? "Отправляем..." : "Отправить билет повторно"}</Text></TouchableOpacity>
            {!refundInfo && <TouchableOpacity disabled={!!busyAction} style={styles.refundButton} onPress={() => void openRefund()}><Ionicons name="return-down-back-outline" size={20} color="#B42318" /><Text style={styles.refundText}>{busyAction === "refund" ? "Проверяем..." : "Вернуть деньги"}</Text></TouchableOpacity>}
            {refundInfo && <View style={styles.refundPanel}>
              <Text style={styles.refundTitle}>Возврат через HYP</Text>
              <Text style={styles.refundAvailable}>Доступно: {money(refundInfo.refundableMinor)}</Text>
              <TextInput value={refundAmount} onChangeText={setRefundAmount} keyboardType="decimal-pad" style={styles.refundInput} placeholder="Сумма возврата" />
              <TextInput value={refundReason} onChangeText={setRefundReason} style={[styles.refundInput, styles.reasonInput]} placeholder="Причина возврата" multiline />
              <TouchableOpacity disabled={!!busyAction} style={styles.refundConfirm} onPress={confirmRefund}><Text style={styles.refundConfirmText}>{busyAction === "refund" ? "Отправляем в HYP..." : "Продолжить возврат"}</Text></TouchableOpacity>
            </View>}
          </>}

          {group === "abandoned" && <View style={styles.recoveryBox}><Ionicons name="cart-outline" size={22} color="#6D45FF" /><View style={{ flex: 1 }}><Text style={styles.recoveryTitle}>Потерянная продажа</Text><Text style={styles.recoveryText}>Клиент начал оформление, но не завершил покупку. Свяжитесь с ним по WhatsApp, телефону или email.</Text></View></View>}
        </ScrollView>}</View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue} numberOfLines={1}>{value || "-"}</Text></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 76, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  headerTitle: { fontSize: 17, lineHeight: 21, fontWeight: "900", color: "#17213C", textAlign: "center" },
  headerMeta: { fontSize: 11.5, color: "#7B8498", marginTop: 4 },
  summary: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  summaryValue: { fontSize: 18, fontWeight: "900", color: "#17213C", textAlign: "center" },
  summaryLabel: { fontSize: 10.5, color: "#8B93A3", marginTop: 3, textAlign: "center" },
  tabsScroll: { maxHeight: 66, backgroundColor: "#fff" },
  tabs: { paddingHorizontal: 10, alignItems: "stretch" },
  tab: { minWidth: 92, paddingHorizontal: 11, paddingVertical: 11, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#6D45FF" },
  tabText: { fontSize: 12, fontWeight: "700", color: "#737C90" },
  tabTextActive: { color: "#6D45FF" },
  tabCount: { fontSize: 11, color: "#9AA1B0", marginTop: 3 },
  searchRow: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: "#F5F6FA", paddingBottom: 6 },
  searchBox: { flex: 1, height: 46, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E5EC", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13 },
  searchInput: { flex: 1, fontSize: 14 },
  filterButton: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E5EC", alignItems: "center", justifyContent: "center" },
  filterButtonActive: { backgroundColor: "#6D45FF", borderColor: "#6D45FF" },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 7, backgroundColor: "#F5F6FA" },
  swipeHintApprove: { fontSize: 10.5, color: "#168044", fontWeight: "800" },
  swipeHintReject: { fontSize: 10.5, color: "#B42318", fontWeight: "800" },
  swipeHintDot: { color: "#A0A7B5" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingBottom: 90 },
  listLoader: { height: 54, alignItems: "center", justifyContent: "center" },
  orderCardWrap: { marginBottom: 8 },
  orderCard: { minHeight: 112, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E6E9EF", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "flex-start" },
  avatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginRight: 11, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarLost: { backgroundColor: "#FFF3E8" },
  orderCardBody: { flex: 1 },
  orderCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderIdentity: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  customerName: { maxWidth: "78%", fontSize: 15, fontWeight: "900", color: "#17213C" },
  lostBadge: { borderRadius: 99, backgroundColor: "#FFF3E8", paddingHorizontal: 7, paddingVertical: 2 },
  lostBadgeText: { color: "#B54708", fontSize: 9.5, fontWeight: "800" },
  personMeta: { fontSize: 11.5, color: "#737C90", marginTop: 3 },
  phone: { fontSize: 11.5, color: "#60708A", marginTop: 2 },
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  socialChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, backgroundColor: "#F5F6FA", paddingHorizontal: 7, paddingVertical: 4 },
  socialChipText: { fontSize: 9.5, color: "#4E5668", fontWeight: "700" },
  blockedText: { fontSize: 10.5, color: "#B54708", marginTop: 7 },
  orderEnd: { alignItems: "flex-end", minWidth: 78, marginLeft: 8 },
  amount: { fontSize: 14, fontWeight: "900", color: "#17213C" },
  age: { fontSize: 10, color: "#9AA1B0", marginTop: 4, marginBottom: 2 },
  attributionBadge: { alignSelf: "flex-start", maxWidth: "100%", marginTop: 8, borderRadius: 12, backgroundColor: "#F3F0FF", paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 7 },
  attributionCopy: { flexShrink: 1 },
  attributionLabel: { fontSize: 10.5, color: "#3E2AA8", fontWeight: "800" },
  attributionDetail: { fontSize: 9.5, color: "#7B6EB7", marginTop: 1 },
  ticketStrip: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  ticketType: { flexShrink: 1, fontSize: 11.5, color: "#17213C", fontWeight: "700" },
  ticketCountPill: { borderRadius: 99, backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 3 },
  ticketCountText: { color: "#4E3AC5", fontSize: 9.5, fontWeight: "800" },
  empty: { padding: 42, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "900", color: "#17213C" },
  emptyText: { color: "#8A92A3", marginTop: 6, textAlign: "center" },
  scannerButton: { position: "absolute", bottom: 18, alignSelf: "center", minWidth: 138, height: 52, borderRadius: 26, backgroundColor: "#071536", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 22 },
  scannerText: { color: "#fff", fontWeight: "900" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,21,54,.32)" },
  sheet: { maxHeight: "82%", backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18 },
  filterSheet: { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#DDE1E9", alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetIdentity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sheetAvatar: { width: 48, height: 48, borderRadius: 15 },
  sheetAvatarFallback: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2FF" },
  sheetTitle: { fontSize: 21, fontWeight: "900", color: "#17213C" },
  sheetId: { color: "#8A92A3", marginTop: 3 },
  contactRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  contactButton: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: "#F4F6FA", alignItems: "center", justifyContent: "center", gap: 4 },
  contactText: { fontSize: 10.5, fontWeight: "700", color: "#17213C" },
  profileLinks: { flexDirection: "row", gap: 8, marginBottom: 14 },
  profileLinkButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: "#F7F7FA", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  profileLinkText: { fontSize: 11, fontWeight: "800", color: "#17213C" },
  detailCard: { borderWidth: 1, borderColor: "#E6E9EF", borderRadius: 16, paddingHorizontal: 14, marginBottom: 14 },
  detailRow: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ECEEF3" },
  detailLabel: { color: "#7B8498", fontSize: 12 },
  detailValue: { color: "#17213C", fontSize: 12, fontWeight: "700", maxWidth: "65%" },
  warningBox: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: "#FFF3E8", borderRadius: 14, padding: 12, marginBottom: 12 },
  warningText: { flex: 1, color: "#B54708", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  reviewActions: { flexDirection: "row", gap: 10 },
  reviewButton: { flex: 1, height: 52, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  rejectButton: { backgroundColor: "#FFF0EE", borderWidth: 1, borderColor: "#FFD0CA" },
  approveButton: { backgroundColor: "#168044" },
  disabledButton: { opacity: 0.35 },
  disabledApprove: { backgroundColor: "#AAB0BC" },
  rejectText: { color: "#B42318", fontWeight: "900" },
  approveText: { color: "#fff", fontWeight: "900" },
  resendButton: { height: 52, borderRadius: 15, backgroundColor: "#F3F5F8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 10 },
  resendText: { color: "#17213C", fontWeight: "800" },
  refundButton: { height: 52, borderRadius: 15, backgroundColor: "#FFF0EE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  refundText: { color: "#B42318", fontWeight: "800" },
  refundPanel: { backgroundColor: "#FAFAFC", borderRadius: 16, padding: 14, gap: 10 },
  refundTitle: { fontSize: 16, fontWeight: "900", color: "#17213C" },
  refundAvailable: { color: "#737C90" },
  refundInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#DDE1EA", backgroundColor: "#fff", paddingHorizontal: 13 },
  reasonInput: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
  refundConfirm: { height: 50, borderRadius: 14, backgroundColor: "#B42318", alignItems: "center", justifyContent: "center" },
  refundConfirmText: { color: "#fff", fontWeight: "900" },
  recoveryBox: { flexDirection: "row", gap: 10, backgroundColor: "#F3F0FF", borderRadius: 15, padding: 14 },
  recoveryTitle: { color: "#3E2AA8", fontWeight: "900", marginBottom: 4 },
  recoveryText: { color: "#625B7C", fontSize: 12, lineHeight: 17 },
  filterSectionTitle: { fontSize: 12, color: "#7B8498", marginTop: 8, marginBottom: 8, fontWeight: "800" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horizontalChips: { gap: 8, paddingBottom: 4 },
  filterChip: { borderRadius: 99, borderWidth: 1, borderColor: "#DDE1EA", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  filterChipActive: { backgroundColor: "#6D45FF", borderColor: "#6D45FF" },
  filterChipText: { color: "#606A7D", fontSize: 11, fontWeight: "700" },
  filterChipTextActive: { color: "#fff" },
  filterFooter: { flexDirection: "row", gap: 10, marginTop: 20 },
  resetButton: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#DDE1EA", alignItems: "center", justifyContent: "center" },
  resetButtonText: { color: "#606A7D", fontWeight: "800" },
  applyButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#6D45FF", alignItems: "center", justifyContent: "center" },
  applyButtonText: { color: "#fff", fontWeight: "900" },
});