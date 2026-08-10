import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { deleteEventDraft, patchEventEditor, type EventEditorState } from "@/lib/event-editor-api";

export function ReviewTab({ eventId, state, onState }: { eventId: string; state: EventEditorState; onState: (v: EventEditorState) => void }) {
  const router = useRouter();
  const canEdit = state.permissions.includes("EVENT_MANAGE"); const [busy, setBusy] = useState(""); const r = state.review;
  async function run(key: string, action: Record<string, unknown>, success: string) { setBusy(key); try { const next = await patchEventEditor(eventId, action); onState(next); Alert.alert("Готово", success); } catch (e) { Alert.alert("Не удалось выполнить действие", e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(""); } }
  function archive() { const restoring = r.archived; Alert.alert(restoring ? "Восстановить мероприятие?" : "Архивировать мероприятие?", restoring ? "Оно вернётся как черновик." : "Оно исчезнет из публичной афиши, но заказы и билеты сохранятся.", [{ text: "Отмена", style: "cancel" }, { text: restoring ? "Восстановить" : "Архивировать", style: restoring ? "default" : "destructive", onPress: () => run("archive", { action: "archive", archiveAction: restoring ? "restore" : "archive" }, restoring ? "Мероприятие восстановлено." : "Мероприятие архивировано.") }]); }
  function removeDraft() {
    Alert.alert(
      "Удалить черновик?",
      "Черновик будет удалён безвозвратно. Это действие доступно только для неопубликованного мероприятия без заказов и истории продаж.",
      [
        { text: "Отмена", style: "cancel" },
        { text: "Удалить", style: "destructive", onPress: async () => {
          setBusy("delete");
          try {
            await deleteEventDraft(eventId);
            Alert.alert("Черновик удалён", "Мероприятие удалено.", [{ text: "OK", onPress: () => router.replace("/") }]);
          } catch (e) {
            Alert.alert("Не удалось удалить черновик", e instanceof Error ? e.message : "Ошибка");
          } finally {
            setBusy("");
          }
        } },
      ],
    );
  }
  const publicUrl = `https://www.atlas-one.co/events/${r.slug}`;
  return <ScrollView contentContainerStyle={s.content}><Text style={s.title}>Проверка</Text><Text style={s.help}>Финальная сводка, публикация и жизненный цикл мероприятия.</Text>
    <View style={s.card}><Text style={s.eventTitle}>{state.event.title}</Text><View style={s.stats}><Stat label="Статус" value={r.archived ? "ARCHIVED" : r.status} /><Stat label="Формат" value={r.mapEnabled ? "С выбором мест" : "Без схемы"} /><Stat label="Категорий" value={String(r.categoryCount)} /><Stat label="Продано" value={`${r.sold}/${r.capacity}`} /></View></View>
    <View style={s.card}><Text style={s.cardTitle}>Проверка перед запуском</Text><Check ok={state.event.title.trim().length >= 3} text="Название мероприятия" /><Check ok={state.event.description.trim().length >= 20} text="Полное описание" /><Check ok={Boolean(state.event.venue.name && state.event.venue.city && state.event.venue.address)} text="Площадка и адрес" /><Check ok={r.categoryCount > 0} text="Есть хотя бы одна категория билетов" /><Check ok={!r.mapEnabled || state.map.objects.length > 0} text={r.mapEnabled ? "На карте есть объекты" : "Карта не требуется"} /></View>
    <View style={s.card}><Text style={s.cardTitle}>Предварительный просмотр</Text><Text style={s.help}>Публичная страница открывается в браузере. Для черновика она может быть недоступна покупателям до публикации.</Text><TouchableOpacity style={s.secondary} onPress={() => Linking.openURL(publicUrl)}><Text style={s.secondaryText}>Открыть публичную страницу</Text></TouchableOpacity></View>
    {canEdit && !r.archived && <View style={s.card}><Text style={s.cardTitle}>{r.status === "DRAFT" ? "Готово к публикации?" : "Мероприятие опубликовано"}</Text><Text style={s.help}>{r.status === "DRAFT" ? "После публикации публичная страница станет доступна покупателям." : "При необходимости мероприятие можно вернуть в черновики."}</Text><Action busy={busy === "status"} label={r.status === "DRAFT" ? "Опубликовать мероприятие" : "Вернуть в черновики"} onPress={() => run("status", { action: "status", status: r.status === "DRAFT" ? "PUBLISHED" : "DRAFT" }, r.status === "DRAFT" ? "Мероприятие опубликовано." : "Мероприятие возвращено в черновики.")} /></View>}
    {canEdit && r.status === "DRAFT" && !r.archived && <View style={[s.card, s.deleteCard]}><Text style={s.cardTitle}>Удаление черновика</Text><Text style={s.help}>Если мероприятие ещё не публиковалось и в нём нет заказов или продаж, его можно удалить полностью.</Text><TouchableOpacity disabled={busy === "delete"} style={s.deleteButton} onPress={removeDraft}>{busy === "delete" ? <ActivityIndicator color="#B42318" /> : <Text style={s.deleteText}>Удалить черновик</Text>}</TouchableOpacity></View>}
    {canEdit && r.status !== "DRAFT" && <View style={[s.card, { borderColor: r.archived ? "#94A3B8" : "#F59E0B" }]}><Text style={s.cardTitle}>{r.archived ? "Мероприятие в архиве" : "Архивирование"}</Text><Text style={s.help}>{r.archived ? "Заказы, билеты и настройки сохранены." : "Архивирование скрывает мероприятие и закрывает публичные продажи, сохраняя историю."}</Text><TouchableOpacity disabled={busy === "archive"} style={[s.archive, r.archived && s.restore]} onPress={archive}>{busy === "archive" ? <ActivityIndicator /> : <Text style={s.archiveText}>{r.archived ? "Восстановить как черновик" : "Архивировать мероприятие"}</Text>}</TouchableOpacity></View>}
  </ScrollView>;
}
function Stat({ label, value }: { label: string; value: string }) { return <View style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>; }
function Check({ ok, text }: { ok: boolean; text: string }) { return <View style={s.check}><Text style={[s.checkIcon, { color: ok ? "#16A34A" : "#DC2626" }]}>{ok ? "✓" : "!"}</Text><Text style={s.checkText}>{text}</Text></View>; }
function Action({ busy, label, onPress }: { busy: boolean; label: string; onPress: () => void }) { return <TouchableOpacity style={s.primary} disabled={busy} onPress={onPress}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{label}</Text>}</TouchableOpacity>; }
const s = StyleSheet.create({ content: { padding: 18, paddingBottom: 90 }, title: { fontSize: 28, fontWeight: "900", color: "#17213C" }, help: { color: "#7B8498", lineHeight: 19, marginTop: 4, marginBottom: 14 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E4EC", borderRadius: 18, padding: 16, marginBottom: 14 }, eventTitle: { fontSize: 22, fontWeight: "900", color: "#17213C" }, stats: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 9 }, stat: { width: "47%", backgroundColor: "#F7F8FB", borderRadius: 13, padding: 12 }, statLabel: { color: "#7D8596", fontSize: 11 }, statValue: { color: "#17213C", fontWeight: "900", marginTop: 4 }, cardTitle: { fontSize: 18, fontWeight: "900", color: "#17213C", marginBottom: 8 }, check: { flexDirection: "row", alignItems: "center", minHeight: 42, borderBottomWidth: 1, borderBottomColor: "#ECEEF3" }, checkIcon: { width: 28, fontSize: 18, fontWeight: "900" }, checkText: { flex: 1, color: "#364057" }, primary: { minHeight: 52, backgroundColor: "#17213C", borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 }, primaryText: { color: "#fff", fontWeight: "900" }, secondary: { minHeight: 48, backgroundColor: "#F2F3F7", borderRadius: 13, alignItems: "center", justifyContent: "center" }, secondaryText: { fontWeight: "900", color: "#3D4861" }, archive: { minHeight: 50, borderRadius: 14, backgroundColor: "#FFF1D6", borderWidth: 1, borderColor: "#F59E0B", alignItems: "center", justifyContent: "center" }, restore: { backgroundColor: "#F1F5F9", borderColor: "#94A3B8" }, archiveText: { fontWeight: "900", color: "#3D4658" }, deleteCard: { borderColor: "#FDA29B", backgroundColor: "#FFFBFA" }, deleteButton: { minHeight: 50, borderRadius: 14, backgroundColor: "#FEF3F2", borderWidth: 1, borderColor: "#FDA29B", alignItems: "center", justifyContent: "center" }, deleteText: { fontWeight: "900", color: "#B42318" } });
