export type EventFaqItem = {
  question: string;
  answer: string;
};

export type EventPresentation = {
  shortDescription: string;
  galleryEnabled: boolean;
  galleryUrls: string[];
  faq: EventFaqItem[];
};

const PRESENTATION_MARKER = /<!--ATLAS_EVENT_PRESENTATION:([A-Za-z0-9+/=]+)-->/;
const remoteImageUrl = /^https?:\/\//i;
const inlineImageUrl = /^data:image\/(?:jpeg|png|webp);base64,/i;

export const emptyEventPresentation: EventPresentation = {
  shortDescription: "",
  galleryEnabled: false,
  galleryUrls: [],
  faq: [],
};

function validImageUrl(value: unknown): value is string {
  return typeof value === "string" && (remoteImageUrl.test(value) || inlineImageUrl.test(value));
}

function normalizeFaq(value: unknown): EventFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const question = typeof item?.question === "string" ? item.question.trim().slice(0, 180) : "";
    const answer = typeof item?.answer === "string" ? item.answer.trim().slice(0, 1200) : "";
    return question && answer ? [{ question, answer }] : [];
  }).slice(0, 7);
}

export function parseEventPresentation(description: string): EventPresentation {
  const encoded = description.match(PRESENTATION_MARKER)?.[1];
  if (!encoded) return emptyEventPresentation;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    const shortDescription = typeof parsed?.shortDescription === "string"
      ? parsed.shortDescription.trim().slice(0, 150)
      : "";
    const galleryUrls = Array.isArray(parsed?.galleryUrls)
      ? parsed.galleryUrls.filter(validImageUrl).slice(0, 6)
      : [];

    return {
      shortDescription,
      galleryEnabled: parsed?.galleryEnabled === true && galleryUrls.length > 0,
      galleryUrls,
      faq: normalizeFaq(parsed?.faq),
    };
  } catch {
    return emptyEventPresentation;
  }
}

export function stripEventPresentation(description: string) {
  return description.replace(PRESENTATION_MARKER, "").trim();
}

export function withEventPresentation(description: string, presentation: EventPresentation) {
  const clean = stripEventPresentation(description);
  const normalized: EventPresentation = {
    shortDescription: presentation.shortDescription.trim().slice(0, 150),
    galleryEnabled: presentation.galleryEnabled && presentation.galleryUrls.length > 0,
    galleryUrls: presentation.galleryUrls.filter(validImageUrl).slice(0, 6),
    faq: normalizeFaq(presentation.faq),
  };

  if (!normalized.shortDescription && !normalized.galleryUrls.length && !normalized.faq.length) return clean;

  const encoded = Buffer.from(JSON.stringify(normalized), "utf8").toString("base64");
  return `${clean}\n<!--ATLAS_EVENT_PRESENTATION:${encoded}-->`;
}
