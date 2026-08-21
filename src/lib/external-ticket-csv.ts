import type { ExternalTicketImportRow, ExternalTicketStatus } from "@/lib/external-tickets";

export const externalTicketFields = [
  "scanCode",
  "externalTicketId",
  "externalOrderId",
  "holderName",
  "firstName",
  "lastName",
  "phone",
  "email",
  "ticketType",
  "price",
  "priceMinor",
  "currency",
  "status",
  "organizerConsent",
] as const;

export type ExternalTicketField = (typeof externalTicketFields)[number];
export type ExternalTicketMapping = Partial<Record<ExternalTicketField, string>>;

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

const aliases: Record<ExternalTicketField, string[]> = {
  scanCode: ["qr", "qr code", "qrcode", "barcode", "bar code", "ticket barcode", "ticket qr", "scan code", "код qr", "штрихкод"],
  externalTicketId: ["ticket id", "ticket number", "ticket no", "ticketid", "номер билета", "id билета"],
  externalOrderId: ["order id", "order number", "order no", "booking id", "номер заказа", "id заказа"],
  holderName: ["name", "full name", "customer name", "buyer name", "holder name", "guest name", "фио", "покупатель", "שם מלא"],
  firstName: ["first name", "firstname", "customer first name", "buyer first name", "имя", "שם פרטי"],
  lastName: ["last name", "lastname", "customer last name", "buyer last name", "фамилия", "שם משפחה"],
  phone: ["phone", "mobile", "telephone", "customer phone", "buyer phone", "телефон", "мобильный", "טלפון", "נייד"],
  email: ["email", "e mail", "mail", "customer email", "buyer email", "почта", "электронная почта", "אימייל", "דואר אלקטרוני"],
  ticketType: ["ticket type", "ticket category", "category", "price type", "тип билета", "категория", "тариф", "סוג כרטיס"],
  price: ["price", "amount", "ticket price", "цена", "сумма", "מחיר"],
  priceMinor: ["price minor", "amount minor", "price cents", "agorot"],
  currency: ["currency", "валюта", "מטבע"],
  status: ["status", "ticket status", "статус", "статус билета", "סטטוס"],
  organizerConsent: [
    "organizer consent", "club consent", "marketing consent", "mailing consent", "newsletter consent", "consent",
    "согласие организатора", "согласие на рассылку", "согласие", "рассылка",
    "אישור דיוור", "הסכמה לדיוור", "מאשר דיוור", "דיוור", "מועדון לקוחות", "אישור מועדון", "הסכמה למועדון",
  ],
};

function separatorScore(line: string, separator: string) {
  let score = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && char === separator) score += 1;
  }
  return score;
}

export function detectCsvDelimiter(text: string) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [",", ";", "\t"];
  return candidates.sort((a, b) => separatorScore(firstLine, b) - separatorScore(firstLine, a))[0];
}

export function parseCsv(text: string) {
  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const value = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) {
      if (char === '"') {
        if (value[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }

    if (char === '"' && cell.length === 0) quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim().replace(/\r$/, ""));
      if (row.some((item) => item.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }

  row.push(cell.trim().replace(/\r$/, ""));
  if (row.some((item) => item.length > 0)) rows.push(row);
  if (!rows.length) throw new Error("CSV файл пуст");

  const rawHeaders = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((header) => {
    const count = seen.get(header) || 0;
    seen.set(header, count + 1);
    return count ? `${header} (${count + 1})` : header;
  });
  const records = rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  return { delimiter, headers, records };
}

export function detectExternalTicketMapping(headers: string[]): ExternalTicketMapping {
  const normalized = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  const mapping: ExternalTicketMapping = {};
  for (const field of externalTicketFields) {
    const fieldAliases = new Set(aliases[field].map(normalizeHeader));
    const match = normalized.find((header) => fieldAliases.has(header.normalized));
    if (match) mapping[field] = match.raw;
  }
  return mapping;
}

function valueFor(record: Record<string, string>, mapping: ExternalTicketMapping, field: ExternalTicketField) {
  const header = mapping[field];
  return header ? record[header]?.trim() || "" : "";
}

function parsePriceMinor(record: Record<string, string>, mapping: ExternalTicketMapping) {
  const direct = valueFor(record, mapping, "priceMinor");
  if (direct) {
    const parsed = Number(direct.replace(/[^\d-]/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  const major = valueFor(record, mapping, "price");
  if (!major) return null;
  const normalized = major.replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function parseStatus(value: string): ExternalTicketStatus {
  const normalized = value.trim().toLowerCase();
  if (["used", "scanned", "checked in", "checked-in", "использован", "погашен"].includes(normalized)) return "USED";
  if (["cancelled", "canceled", "refunded", "void", "отменен", "отменён", "возврат"].includes(normalized)) return "CANCELLED";
  return "VALID";
}

export function parseOrganizerConsent(value: string) {
  const normalized = value.trim().toLowerCase();
  return new Set(["yes", "true", "1", "y", "checked", "approved", "כן", "מאשר", "מאשרת", "מאושר", "מאושרת", "✓", "v"]).has(normalized);
}

export function mapCsvRecordsToExternalTickets(records: Record<string, string>[], mapping: ExternalTicketMapping) {
  if (!mapping.scanCode) throw new Error("Не выбрана колонка QR / Barcode");
  return records.map<ExternalTicketImportRow>((record) => {
    const firstName = valueFor(record, mapping, "firstName");
    const lastName = valueFor(record, mapping, "lastName");
    const mappedName = valueFor(record, mapping, "holderName");
    const combinedName = [firstName, lastName].filter(Boolean).join(" ");
    const consentValue = valueFor(record, mapping, "organizerConsent");
    return {
      scanCode: valueFor(record, mapping, "scanCode"),
      externalTicketId: valueFor(record, mapping, "externalTicketId") || null,
      externalOrderId: valueFor(record, mapping, "externalOrderId") || null,
      holderName: mappedName || combinedName || null,
      phone: valueFor(record, mapping, "phone") || null,
      email: valueFor(record, mapping, "email") || null,
      ticketType: valueFor(record, mapping, "ticketType") || null,
      priceMinor: parsePriceMinor(record, mapping),
      currency: valueFor(record, mapping, "currency") || null,
      status: parseStatus(valueFor(record, mapping, "status")),
      metadata: {
        ...record,
        __atlasOrganizerConsent: Boolean(mapping.organizerConsent) && parseOrganizerConsent(consentValue),
        __atlasConsentColumn: mapping.organizerConsent || null,
        __atlasFirstName: firstName || null,
        __atlasLastName: lastName || null,
      },
    };
  });
}

export function validateExternalTicketMapping(mapping: ExternalTicketMapping, headers: string[]) {
  const headerSet = new Set(headers);
  for (const [field, header] of Object.entries(mapping)) {
    if (!externalTicketFields.includes(field as ExternalTicketField)) throw new Error(`Неизвестное поле mapping: ${field}`);
    if (header && !headerSet.has(header)) throw new Error(`Колонка ${header} отсутствует в файле`);
  }
  if (!mapping.scanCode) throw new Error("Нужно выбрать колонку QR / Barcode");
  return mapping;
}
