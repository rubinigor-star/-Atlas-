const MARKER = "ATLAS_REJECTION_MESSAGE";
const PATTERN = new RegExp(`\\n?<!--${MARKER}:([A-Za-z0-9+/=]+)-->`, "g");

export const DEFAULT_REJECTION_MESSAGE =
  "К сожалению, ваша заявка не была подтверждена из-за высокой загрузки мероприятия. Ваша заявка сохранена в списке ожидания. Если появятся свободные места, организатор сможет связаться с вами дополнительно. Авторизация оплаты отменена. Списание денежных средств не производилось.";

export function parseEventRejectionMessage(description: string) {
  const matches = [...description.matchAll(PATTERN)];
  const encoded = matches.at(-1)?.[1];
  if (!encoded) return DEFAULT_REJECTION_MESSAGE;
  try {
    return Buffer.from(encoded, "base64").toString("utf8") || DEFAULT_REJECTION_MESSAGE;
  } catch {
    return DEFAULT_REJECTION_MESSAGE;
  }
}

export function stripEventRejectionMessage(description: string) {
  return description.replace(PATTERN, "").trim();
}

export function withEventRejectionMessage(description: string, message: string) {
  const clean = stripEventRejectionMessage(description);
  const normalized = message.trim() || DEFAULT_REJECTION_MESSAGE;
  const encoded = Buffer.from(normalized, "utf8").toString("base64");
  return `${clean}\n<!--${MARKER}:${encoded}-->`;
}
