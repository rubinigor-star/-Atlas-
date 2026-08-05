export type EventMediaItem =
  | { type: "VIDEO" | "IMAGE" | "LINK"; url: string; title?: string }
  | { type: "SUMMARY"; text: string };

const MEDIA_MARKER = /<!--ATLAS_EVENT_MEDIA:([A-Za-z0-9+/=]+)-->/;
const remoteUrl = /^https?:\/\//i;
const imageDataUrl = /^data:image\/(?:jpeg|png|webp);base64,/i;

export function parseEventMedia(description: string): EventMediaItem[] {
  const match = description.match(MEDIA_MARKER);
  if (!match) return [];
  try {
    const value = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): EventMediaItem[] => {
      if (!item || typeof item !== "object") return [];
      if (item.type === "SUMMARY" && typeof item.text === "string") {
        const text = item.text.trim().slice(0, 250);
        return text ? [{ type: "SUMMARY", text }] : [];
      }
      if ((item.type === "VIDEO" || item.type === "IMAGE" || item.type === "LINK") && typeof item.url === "string") {
        const url = item.url.trim();
        const valid = item.type === "IMAGE" ? remoteUrl.test(url) || imageDataUrl.test(url) : remoteUrl.test(url);
        if (!valid) return [];
        return [{ type: item.type, url, title: typeof item.title === "string" ? item.title.trim().slice(0, 120) || undefined : undefined }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export function stripEventMedia(description: string) {
  return description.replace(MEDIA_MARKER, "").trim();
}

export function withEventMedia(description: string, media: EventMediaItem[]) {
  const clean = stripEventMedia(description);
  const normalized = media.flatMap((item): EventMediaItem[] => {
    if (item.type === "SUMMARY") {
      const text = item.text.trim().slice(0, 250);
      return text ? [{ type: "SUMMARY", text }] : [];
    }
    const url = item.url.trim();
    const valid = item.type === "IMAGE" ? remoteUrl.test(url) || imageDataUrl.test(url) : remoteUrl.test(url);
    if (!valid) return [];
    return [{ type: item.type, url, title: item.title?.trim().slice(0, 120) || undefined }];
  });
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

export function videoThumbnailUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }
  } catch {}
  return null;
}