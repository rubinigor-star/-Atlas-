import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/auth";
import {
  detectExternalTicketMapping,
  mapCsvRecordsToExternalTickets,
  parseCsv,
  type ExternalTicketMapping,
  validateExternalTicketMapping,
} from "@/lib/external-ticket-csv";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
import { importExternalTickets } from "@/lib/external-tickets";
import { syncExternalCustomerProfiles } from "@/lib/external-customer-profiles";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 50_000;
type ConsentMode = "NONE" | "ALL" | "COLUMN";

function formString(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isTextTicketFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv" || file.type === "text/plain";
}

function parseConsentMode(value: string): ConsentMode {
  if (value === "ALL" || value === "COLUMN") return value;
  return "NONE";
}

function applyKnownPlatformDefaults(mapping: ExternalTicketMapping, headers: string[], platformKey?: string) {
  const headerSet = new Set(headers);
  const next = { ...mapping };
  const isEventer = platformKey?.toUpperCase() === "EVENTER" || headerSet.has("מזהה כרטיס");
  if (!isEventer) return next;

  if (headerSet.has("מזהה כרטיס")) {
    next.scanCode = "מזהה כרטיס";
    next.externalTicketId = "מזהה כרטיס";
  }
  if (headerSet.has("מס' הזמנה")) next.externalOrderId = "מס' הזמנה";
  if (headerSet.has("שם")) next.holderName = "שם";
  if (headerSet.has("טלפון")) next.phone = "טלפון";
  if (headerSet.has("אימייל")) next.email = "אימייל";
  if (headerSet.has("גיל")) next.birthDate = "גיל";
  if (headerSet.has("עיר מגורים")) next.city = "עיר מגורים";
  if (headerSet.has("מין")) next.gender = "מין";
  if (headerSet.has("סוג כרטיס")) next.ticketType = "סוג כרטיס";
  if (headerSet.has("מחיר כרטיס")) next.price = "מחיר כרטיס";
  return next;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let eventId = "unknown";
  let uploadName = "unknown";
  try {
    const resolved = await params;
    eventId = resolved.id;
    const staff = await requireEventAccess("TICKET_MANAGE", eventId);
    await ensureExternalTicketStorage();
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) throw new Error("Выберите CSV файл");
    uploadName = upload.name;
    if (!isTextTicketFile(upload)) throw new Error("Сейчас поддерживается CSV/TXT. XLSX добавим отдельным адаптером.");
    if (upload.size > MAX_FILE_BYTES) throw new Error("Файл больше 15 MB");

    const sourceName = formString(form, "sourceName") || upload.name.replace(/\.(csv|txt)$/i, "") || "Imported";
    const sourceKey = formString(form, "sourceKey") || undefined;
    const platformKey = formString(form, "platformKey") || undefined;
    const consentMode = parseConsentMode(formString(form, "consentMode"));
    const parsed = parseCsv(await upload.text());
    if (parsed.records.length > MAX_ROWS) throw new Error(`В одном импорте допускается до ${MAX_ROWS} строк`);

    let mapping: ExternalTicketMapping = applyKnownPlatformDefaults(detectExternalTicketMapping(parsed.headers), parsed.headers, platformKey);
    const mappingValue = formString(form, "mapping");
    if (mappingValue) {
      const candidate = JSON.parse(mappingValue) as ExternalTicketMapping;
      mapping = applyKnownPlatformDefaults(candidate, parsed.headers, platformKey);
    }
    mapping = validateExternalTicketMapping(mapping, parsed.headers);

    if (consentMode === "COLUMN" && !mapping.organizerConsent) throw new Error("Выберите колонку, где указано согласие клиента");
    if (consentMode !== "COLUMN") delete mapping.organizerConsent;

    const mappedRows = mapCsvRecordsToExternalTickets(parsed.records, mapping);
    const rows = mappedRows.map((row) => ({
      ...row,
      metadata: {
        ...(row.metadata || {}),
        __atlasOrganizerConsent: consentMode === "ALL" ? true : consentMode === "NONE" ? false : Boolean(row.metadata?.__atlasOrganizerConsent),
        __atlasConsentMode: consentMode,
        __atlasConsentColumn: consentMode === "COLUMN" ? mapping.organizerConsent || null : null,
        __atlasImportMode: "SILENT_READ_ONLY",
      },
    }));

    const result = await importExternalTickets({
      eventId,
      sourceName,
      sourceKey,
      platformKey,
      fileName: upload.name,
      mapping: { ...(mapping as Record<string, string>), __consentMode: consentMode, __importMode: "SILENT_READ_ONLY" },
      createdById: staff.id,
      rows,
    });

    const customerSync = await syncExternalCustomerProfiles(eventId, result.source.id);
    return NextResponse.json({ ok: true, consentMode, importMode: "SILENT_READ_ONLY", customerSync, ...result });
  } catch (error) {
    console.error("[external-ticket-import] failed", { eventId, uploadName, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    const message = error instanceof Error ? error.message : "Не удалось импортировать внешние билеты";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
