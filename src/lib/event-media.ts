export type EventMediaItem = {
  type: "VIDEO" | "LINK";
  url: string;
  title?: string;
};

const MEDIA_MARKER = /<!--ATLAS_EVENT_MEDIA:([A-Za-z0-9+/=]+)-->/;

export function parseEventMedia(description: string): EventMediaItem[] {
  const match = description.match(MEDIA_MARKER);
  if (!match) return [];
  try {
    const value = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is EventMediaItem =>
      Boolean(item && (item.type === "VIDEO" || item.type === "LINK") && typeof item.url === "string"),
    );
  } catch {
    return [];
  }
}

export function stripEventMedia(description: string) {
  return description.replace(MEDIA_MARKER, "").trim();
}

export function withEventMedia(description: string, media: EventMediaItem[]) {
  const clean = stripEventMedia(description);
  const normalized = media
    .map((item) => ({ type: item.type, url: item.url.trim(), title: item.title?.trim() || undefined }))
    .filter((item) => /^https?:\/\//i.test(item.url));
  if (!normalized.length) return clean;
  const encoded = Buffer.from(JSON.stringify(normalized), "utf8").toString("base64");
  return `${clean}\n<!--ATLAS_EVENT_MEDIA:${encoded}-->`;
}

export function videoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {}
  return null;
}
