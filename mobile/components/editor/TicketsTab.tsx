import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { patchEventEditor, type EditorCategory, type EventEditorState } from "@/lib/event-editor-api";

function day(iso: string) { return iso ? new Date(iso).toISOString().slice(0, 10) : ""; }
function isoStart(value: string) { return new Date(`${value}T00:00:00+03:00`).toISOString(); }
function isoEnd(value: string) { return new Date(`${value}T23:59:59+03:00`).toISOString(); }
function money(minor: number | null) { return minor === null ? "-" : `${(minor / 100).toFixed(2)} ₪`; }

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[s.chip, selected && s.chipOn]} onPress={onPress}><Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text></TouchableOpacity>;
}

type Draft = {
  name: string; description: string; price: string; capacity: string; colorHex: string; pricingMode: "FIXED" | "SCHEDULED"; salesStart: string; salesEnd: string; earlyPrice: string; earlyEnd: string; maxPerOrder: string; salesStrategy: "STANDARD" | "BUY_ONE_GET_ONE";
};
const emptyDraft = (): Draft => ({ name: "", description: "", price: "", capacity: "100", colorHex: "#2563EB", pricingMode: "FIXED", salesStart: day(new Date().toISOString()), salesEnd: day(new Date(Date.now() + 30 * 86400000).toISOString()), earlyPrice: "", earlyEnd: "", maxPerOrder: "5", salesStrategy: "STANDARD" });
function fromCategory(c: EditorCategory): Draft {
  const early = c.priceTiers[0];
  return { name: c.name, description: c.description.replace(/<!--ATLAS_[^>]+-->/g, "").trim(), price: String(c.priceMinor / 100), capacity: String(c.capacity), colorHex: c.colorHex, pricingMode: c.pricingMode, salesStart: day(c.salesStart), salesEnd: day(c.salesEnd), earlyPrice: early ? String(early.priceMinor / 100) : "", earlyEnd: early ? day(early.endsAt) : "", maxPerOrder: String(c.maxPerOrder), salesStrategy: c.salesStrategy };
}

export function TicketsTab({ eventId, state, onState }: { eventId: string; state: EventEditorState; onState: (v: EventEditorState) => void }) {
  const canEdit = state.permissions.includes("TICKET_MANAGE");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const patch = (part: Partial<Draft>) => setDraft((v) => ({ ...v, ...part }));

  async function saveCategory(categoryId?: string) {
    if (!canEdit) return Alert.alert("Нет доступа", "Нужен TICKET_MANAGE.");
    if (draft.name.trim().length < 2 || Number(draft.capacity) < 1 || Number(draft.price) < 0) return Alert.alert("Проверьте данные", "Заполните название, количество и цену.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.salesStart) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.salesEnd)) return Alert.alert("Проверьте даты", "Используйте YYYY-MM-DD.");
    if (draft.pricingMode === "SCHEDULED" && (!draft.earlyPrice || !/^\d{4}-\d{2}-\d{2}$/.test(draft.earlyEnd))) return Alert.alert("Проверьте этап цены", "Укажите раннюю цену и дату её окончания.");
    setBusy(true);
    try {
      const next = await patchEventEditor(eventId, {
        action: categoryId ? "category-update" : "category-create", ...(categoryId ? { categoryId } : {}), name: draft.name.trim(), description: draft.description.trim(), priceMinor: Math.round(Number(draft.price) * 100), capacity: Number(draft.capacity), colorHex: draft.colorHex,
        pricingMode: draft.pricingMode, salesStart: isoStart(draft.salesStart), salesEnd: isoEnd(draft.salesEnd), earlyBirdPriceMinor: draft.pricingMode === "SCHEDULED" ? Math.round(Number(draft.earlyPrice) * 100) : undefined, earlyBirdEndsAt: draft.pricingMode === "SCHEDULED" ? isoEnd(draft.earlyEnd) : undefined, maxPerOrder: Number(draft.maxPerOrder), salesStrategy: draft.salesStrategy,
      });
      onState(next); setCreating(false); setEditing(null); setDraft(emptyDraft());
    } catch (e) { Alert.alert("Не удалось сохранить билет", e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  }

  async function visibility(c: EditorCategory) {
    setBusy(true); try { onState(await patchEventEditor(eventId, { action: "category-visibility", categoryId: c.id, hidden: !c.hidden })); } catch (e) { Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  }
  async function strategy(c: EditorCategory, part: Record<string, unknown>) {
    const value = { ...c.marketingStrategy, ...part };
    setBusy(true); try { onState(await patchEventEditor(eventId, { action: "pricing-strategy", categoryId: c.id, ...value })); } catch (e) { Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  }

  function form(categoryId?: string) {
    return <View style={s.form}>
      <Text style={s.formTitle}>{categoryId ? "Настройка билета" : "Новый билет"}</Text>
      <Field label="Название"><TextInput style={s.input} value={draft.name} onChangeText={(name) => patch({ name })} /></Field>
      <Field label="Что входит"><TextInput style={[s.input, s.multi]} multiline value={draft.description} onChangeText={(description) => patch({ description })} /></Field>
      <View style={s.row}><View style={s.half}><Field label="Количество"><TextInput style={s.input} keyboardType="number-pad" value={draft.capacity} onChangeText={(capacity) => patch({ capacity })} /></Field></View><View style={s.half}><Field label="Цвет #RRGGBB"><TextInput style={s.input} autoCapitalize="characters" value={draft.colorHex} onChangeText={(colorHex) => patch({ colorHex })} /></Field></View></View>
      <Text style={s.label}>Стратегия продажи</Text><View style={s.chips}><Chip label="Стандарт" selected={draft.salesStrategy === "STANDARD"} onPress={() => patch({ salesStrategy: "STANDARD" })} /><Chip label="1+1" selected={draft.salesStrategy === "BUY_ONE_GET_ONE"} onPress={() => patch({ salesStrategy: "BUY_ONE_GET_ONE" })} /></View>
      <Text style={s.label}>Цена</Text><View style={s.chips}><Chip label="Фиксированная" selected={draft.pricingMode === "FIXED"} onPress={() => patch({ pricingMode: "FIXED" })} /><Chip label="По расписанию" selected={draft.pricingMode === "SCHEDULED"} onPress={() => patch({ pricingMode: "SCHEDULED" })} /></View>
      {draft.pricingMode === "SCHEDULED" && <View style={s.row}><View style={s.half}><Field label="Ранняя цена, ₪"><TextInput style={s.input} keyboardType="decimal-pad" value={draft.earlyPrice} onChangeText={(earlyPrice) => patch({ earlyPrice })} /></Field></View><View style={s.half}><Field label="До YYYY-MM-DD"><TextInput style={s.input} value={draft.earlyEnd} onChangeText={(earlyEnd) => patch({ earlyEnd })} /></Field></View></View>}
      <View style={s.row}><View style={s.half}><Field label={draft.salesStrategy === "BUY_ONE_GET_ONE" ? "Цена комплекта, ₪" : "Цена, ₪"}><TextInput style={s.input} keyboardType="decimal-pad" value={draft.price} onChangeText={(price) => patch({ price })} /></Field></View><View style={s.half}><Field label="Макс. в заказе"><TextInput style={s.input} keyboardType="number-pad" value={draft.maxPerOrder} onChangeText={(maxPerOrder) => patch({ maxPerOrder })} /></Field></View></View>
      <View style={s.row}><View style={s.half}><Field label="Продажи с"><TextInput style={s.input} value={draft.salesStart} onChangeText={(salesStart) => patch({ salesStart })} /></Field></View><View style={s.half}><Field label="Продажи до"><TextInput style={s.input} value={draft.salesEnd} onChangeText={(salesEnd) => patch({ salesEnd })} /></Field></View></View>
      <View style={s.row}><TouchableOpacity style={s.secondary} onPress={() => { setCreating(false); setEditing(null); }}><Text>Отмена</Text></TouchableOpacity><TouchableOpacity style={s.primary} disabled={busy} onPress={() => saveCategory(categoryId)}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Сохранить</Text>}</TouchableOpacity></View>
    </View>;
  }

  return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.heading}><View style={{ flex: 1 }}><Text style={s.title}>Билеты и цены</Text><Text style={s.help}>Категории, остаток, расписание цены и маркетинговая стратегия.</Text></View>{canEdit && !creating && <TouchableOpacity style={s.add} onPress={() => { setDraft(emptyDraft()); setCreating(true); setEditing(null); }}><Text style={s.addText}>+ Билет</Text></TouchableOpacity>}</View>
    {creating && form()}
    {state.tickets.categories.map((c) => <View key={c.id} style={[s.card, c.hidden && { opacity: .55 }]}>
      <View style={s.between}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{c.name}</Text><Text style={s.meta}>{money(c.currentPriceMinor)} · продано {c.sold}/{c.capacity}</Text>{c.pricingMode === "SCHEDULED" && <Text style={s.purple}>Цена меняется по расписанию</Text>}</View><TouchableOpacity onPress={() => visibility(c)}><Text style={s.link}>{c.hidden ? "Показать" : "Скрыть"}</Text></TouchableOpacity></View>
      <View style={s.stats}><Text>Остаток: {Math.max(0, c.capacity - c.sold)}</Text><Text>Макс/заказ: {c.maxPerOrder}</Text><Text>{c.salesStrategy === "BUY_ONE_GET_ONE" ? "1+1" : "Standard"}</Text></View>
      {editing === c.id ? form(c.id) : <TouchableOpacity style={s.secondaryWide} onPress={() => { setEditing(c.id); setCreating(false); setDraft(fromCategory(c)); }}><Text style={s.secondaryText}>Настроить билет</Text></TouchableOpacity>}
      <View style={s.strategy}><Text style={s.formTitle}>Маркетинг цены</Text><View style={s.chips}>{(["CALM", "STANDARD", "ACTIVE", "MAXIMUM"] as const).map((x) => <Chip key={x} label={{ CALM: "Спокойно", STANDARD: "Стандарт", ACTIVE: "Активно", MAXIMUM: "Максимум" }[x]} selected={c.marketingStrategy.intensity === x} onPress={() => strategy(c, { intensity: x })} />)}</View>
        <Toggle label="Обратный отсчёт" value={c.marketingStrategy.showCountdown} onChange={(v) => strategy(c, { showCountdown: v })} /><Toggle label="Следующая цена" value={c.marketingStrategy.showNextPrice} onChange={(v) => strategy(c, { showNextPrice: v })} /><Toggle label="Ограниченность этапа" value={c.marketingStrategy.showStageRemaining} onChange={(v) => strategy(c, { showStageRemaining: v })} /><Toggle label="Общий остаток" value={c.marketingStrategy.showTotalRemaining} onChange={(v) => strategy(c, { showTotalRemaining: v })} /><Toggle label="Количество проданных" value={c.marketingStrategy.showSoldCount} onChange={(v) => strategy(c, { showSoldCount: v })} />
      </View>
    </View>)}
    {!state.tickets.categories.length && !creating && <Text style={s.empty}>Категорий пока нет.</Text>}
  </ScrollView>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={{ marginBottom: 12 }}><Text style={s.label}>{label}</Text>{children}</View>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <View style={s.toggle}><Text style={{ flex: 1 }}>{label}</Text><Switch value={value} onValueChange={onChange} /></View>; }
const s = StyleSheet.create({ content: { padding: 18, paddingBottom: 80 }, heading: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 16 }, title: { fontSize: 28, fontWeight: "900", color: "#17213C" }, help: { color: "#7B8498", marginTop: 4, lineHeight: 19 }, add: { backgroundColor: "#6D45FF", paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14 }, addText: { color: "#fff", fontWeight: "800" }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E4EC", borderRadius: 18, padding: 16, marginBottom: 14 }, cardTitle: { fontSize: 18, fontWeight: "900", color: "#17213C" }, meta: { color: "#687287", marginTop: 4 }, purple: { color: "#6D45FF", fontSize: 12, marginTop: 5, fontWeight: "700" }, between: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, link: { color: "#6D45FF", fontWeight: "800" }, stats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }, form: { backgroundColor: "#F8F8FC", borderRadius: 16, padding: 14, marginTop: 12, marginBottom: 12 }, formTitle: { fontWeight: "900", fontSize: 16, color: "#17213C", marginBottom: 10 }, label: { fontSize: 12, fontWeight: "800", color: "#5C667B", marginBottom: 6 }, input: { minHeight: 46, borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12, color: "#17213C" }, multi: { minHeight: 75, paddingTop: 10 }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }, chip: { borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "#EEF0F5" }, chipOn: { backgroundColor: "#EEE9FF", borderWidth: 1, borderColor: "#6D45FF" }, chipText: { color: "#5E677A", fontSize: 12, fontWeight: "700" }, chipTextOn: { color: "#5437DD" }, primary: { flex: 1, minHeight: 48, backgroundColor: "#6D45FF", borderRadius: 13, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontWeight: "900" }, secondary: { flex: 1, minHeight: 48, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 13, alignItems: "center", justifyContent: "center" }, secondaryWide: { marginTop: 13, minHeight: 44, borderRadius: 12, backgroundColor: "#F2F3F7", alignItems: "center", justifyContent: "center" }, secondaryText: { fontWeight: "800", color: "#3E4960" }, strategy: { borderTopWidth: 1, borderTopColor: "#E7E9EF", marginTop: 16, paddingTop: 14 }, toggle: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#ECEEF3" }, empty: { textAlign: "center", color: "#8A92A3", padding: 30 } });
