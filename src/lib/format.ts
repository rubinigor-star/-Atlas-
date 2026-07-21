export function money(minor: number, currency = "ILS") { return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100); }
export function eventDate(date: Date) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(date); }
