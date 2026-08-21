import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/auth";
import { detectExternalTicketMapping, parseCsv } from "@/lib/external-ticket-csv";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 50_000;

function isTextTicketFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv" || file.type === "text/plain";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    await requireEventAccess("TICKET_MANAGE", eventId);
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) throw new Error("Выберите CSV файл");
    if (!isTextTicketFile(upload)) throw new Error("Сейчас поддерживается CSV/TXT. XLSX добавим отдельным адаптером.");
    if (upload.size > MAX_FILE_BYTES) throw new Error("Файл больше 15 MB");

    const parsed = parseCsv(await upload.text());
    if (parsed.records.length > MAX_ROWS) throw new Error(`В одном импорте допускается до ${MAX_ROWS} строк`);
    const mapping = detectExternalTicketMapping(parsed.headers);

    return NextResponse.json({
      fileName: upload.name,
      rowCount: parsed.records.length,
      delimiter: parsed.delimiter === "\t" ? "TAB" : parsed.delimiter,
      headers: parsed.headers,
      detectedMapping: mapping,
      requiresMapping: !mapping.scanCode,
      sample: parsed.records.slice(0, 5),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось прочитать файл";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
