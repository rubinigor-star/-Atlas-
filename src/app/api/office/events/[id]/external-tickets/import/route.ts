import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/auth";
import {
  detectExternalTicketMapping,
  mapCsvRecordsToExternalTickets,
  parseCsv,
  type ExternalTicketMapping,
  validateExternalTicketMapping,
} from "@/lib/external-ticket-csv";
import { importExternalTickets } from "@/lib/external-tickets";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 50_000;

function formString(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isTextTicketFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv" || file.type === "text/plain";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const staff = await requireEventAccess("TICKET_MANAGE", eventId);
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) throw new Error("Выберите CSV файл");
    if (!isTextTicketFile(upload)) throw new Error("Сейчас поддерживается CSV/TXT. XLSX добавим отдельным адаптером.");
    if (upload.size > MAX_FILE_BYTES) throw new Error("Файл больше 15 MB");

    const sourceName = formString(form, "sourceName") || upload.name.replace(/\.(csv|txt)$/i, "") || "External";
    const sourceKey = formString(form, "sourceKey") || undefined;
    const platformKey = formString(form, "platformKey") || undefined;
    const parsed = parseCsv(await upload.text());
    if (parsed.records.length > MAX_ROWS) throw new Error(`В одном импорте допускается до ${MAX_ROWS} строк`);

    let mapping: ExternalTicketMapping = detectExternalTicketMapping(parsed.headers);
    const mappingValue = formString(form, "mapping");
    if (mappingValue) {
      const candidate = JSON.parse(mappingValue) as ExternalTicketMapping;
      mapping = validateExternalTicketMapping(candidate, parsed.headers);
    } else {
      mapping = validateExternalTicketMapping(mapping, parsed.headers);
    }

    const rows = mapCsvRecordsToExternalTickets(parsed.records, mapping);
    const result = await importExternalTickets({
      eventId,
      sourceName,
      sourceKey,
      platformKey,
      fileName: upload.name,
      mapping: mapping as Record<string, string>,
      createdById: staff.id,
      rows,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать внешние билеты";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
