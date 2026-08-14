import { db } from "@/lib/db";

type SocialKind = "INSTAGRAM" | "FACEBOOK";
export type SocialProfileInput = { kind: SocialKind; value: string | null | undefined };
export type SocialProfileResult = { url: string; imageUrl: string | null; kind: SocialKind };

type CacheRow = {
  socialUrl: string;
  kind: SocialKind;
  imageUrl: string | null;
  status: string;
  attemptedAt: Date;
};

let runtimeReady: Promise<void> | undefined;

async function ensureRuntime() {
  runtimeReady ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SocialProfileCache" (
      "socialUrl" TEXT PRIMARY KEY,
      "kind" TEXT NOT NULL,
      "imageUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SocialProfileCache_attemptedAt_idx" ON "SocialProfileCache"("attemptedAt")`);
  })().catch((error) => {
    runtimeReady = undefined;
    throw error;
  });
  return runtimeReady;
}

function allowedHost(hostname: string, kind: SocialKind) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return kind === "INSTAGRAM"
    ? host === "instagram.com" || host.endsWith(".instagram.com")
    : host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host.endsWith(".fb.com");
}

export function normalizeSocialProfile(input: SocialProfileInput): { kind: SocialKind; url: string } | null {
  const raw = input.value?.trim();
  if (!raw) return null;
  let candidate = raw;
  if (candidate.startsWith("@")) {
    const username = candidate.slice(1).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!username) return null;
    candidate = input.kind === "INSTAGRAM" ? `https://www.instagram.com/${username}/` : `https://www.facebook.com/${username}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    if (/^[a-zA-Z0-9._-]+$/.test(candidate)) {
      candidate = input.kind === "INSTAGRAM" ? `https://www.instagram.com/${candidate}/` : `https://www.facebook.com/${candidate}`;
    } else {
      candidate = `https://${candidate}`;
    }
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!allowedHost(url.hostname, input.kind)) return null;
    url.protocol = "https:";
    url.hash = "";
    return { kind: input.kind, url: url.toString() };
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function ogImage(html: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /["']profile_pic_url_hd["']\s*:\s*["']([^"']+)["']/i,
    /["']profile_pic_url["']\s*:\s*["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

function instagramUsername(profileUrl: string) {
  try {
    const url = new URL(profileUrl);
    const first = url.pathname.split("/").filter(Boolean)[0] || "";
    if (!first || ["p", "reel", "reels", "stories", "explore", "accounts"].includes(first.toLowerCase())) return null;
    return /^[a-zA-Z0-9._]+$/.test(first) ? first : null;
  } catch {
    return null;
  }
}

async function instagramProfileImage(profileUrl: string) {
  const username = instagramUsername(profileUrl);
  if (!username) return null;
  try {
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.8",
        "x-ig-app-id": "936619743392459",
        referer: profileUrl,
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return null;
    const json = await response.json() as {
      data?: { user?: { profile_pic_url_hd?: string | null; profile_pic_url?: string | null } | null } | null;
    };
    const image = json.data?.user?.profile_pic_url_hd || json.data?.user?.profile_pic_url || null;
    if (!image) return null;
    const parsed = new URL(image);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function htmlProfileImage(profile: { kind: SocialKind; url: string }) {
  const response = await fetch(profile.url, {
    headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.8",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(4500),
  });
  const finalUrl = new URL(response.url || profile.url);
  if (!allowedHost(finalUrl.hostname, profile.kind)) throw new Error("SOCIAL_REDIRECT_NOT_ALLOWED");
  if (!response.ok) throw new Error(`SOCIAL_HTTP_${response.status}`);
  const html = (await response.text()).slice(0, 1_500_000);
  const image = ogImage(html);
  if (!image) return null;
  const parsed = new URL(image, finalUrl);
  return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
}

async function resolveOne(profile: { kind: SocialKind; url: string }) {
  try {
    let imageUrl: string | null = null;
    if (profile.kind === "INSTAGRAM") imageUrl = await instagramProfileImage(profile.url);
    if (!imageUrl) imageUrl = await htmlProfileImage(profile);

    await db.$executeRawUnsafe(
      `INSERT INTO "SocialProfileCache" ("socialUrl","kind","imageUrl","status","attemptedAt","updatedAt")
       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("socialUrl") DO UPDATE SET "kind"=EXCLUDED."kind","imageUrl"=EXCLUDED."imageUrl","status"=EXCLUDED."status","attemptedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
      profile.url,
      profile.kind,
      imageUrl,
      imageUrl ? "FOUND" : "NOT_FOUND",
    );
  } catch (error) {
    await db.$executeRawUnsafe(
      `INSERT INTO "SocialProfileCache" ("socialUrl","kind","imageUrl","status","attemptedAt","updatedAt")
       VALUES ($1,$2,NULL,'FAILED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("socialUrl") DO UPDATE SET "kind"=EXCLUDED."kind","imageUrl"=NULL,"status"='FAILED',"attemptedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
      profile.url,
      profile.kind,
    ).catch(() => undefined);
    console.info("social_profile_image.resolve_failed", {
      kind: profile.kind,
      url: profile.url,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getCachedSocialProfiles(inputs: SocialProfileInput[]) {
  await ensureRuntime();
  const normalized = inputs.map(normalizeSocialProfile).filter((item): item is { kind: SocialKind; url: string } => Boolean(item));
  const urls = [...new Set(normalized.map((item) => item.url))];
  if (!urls.length) return new Map<string, SocialProfileResult>();
  const placeholders = urls.map((_, index) => `$${index + 1}`).join(",");
  const rows = await db.$queryRawUnsafe<CacheRow[]>(
    `SELECT "socialUrl","kind","imageUrl","status","attemptedAt" FROM "SocialProfileCache" WHERE "socialUrl" IN (${placeholders})`,
    ...urls,
  );
  return new Map(rows.map((row) => [row.socialUrl, { url: row.socialUrl, imageUrl: row.imageUrl, kind: row.kind }]));
}

export async function refreshSocialProfiles(inputs: SocialProfileInput[]) {
  await ensureRuntime();
  const normalized = inputs.map(normalizeSocialProfile).filter((item): item is { kind: SocialKind; url: string } => Boolean(item));
  const unique = [...new Map(normalized.map((item) => [item.url, item])).values()];
  if (!unique.length) return;
  const urls = unique.map((item) => item.url);
  const placeholders = urls.map((_, index) => `$${index + 1}`).join(",");
  const rows = await db.$queryRawUnsafe<CacheRow[]>(
    `SELECT "socialUrl","kind","imageUrl","status","attemptedAt" FROM "SocialProfileCache" WHERE "socialUrl" IN (${placeholders})`,
    ...urls,
  );
  const byUrl = new Map(rows.map((row) => [row.socialUrl, row]));
  const staleBefore = Date.now() - 6 * 60 * 60 * 1000;
  const targets = unique.filter((item) => {
    const cached = byUrl.get(item.url);
    return !cached || !cached.imageUrl || new Date(cached.attemptedAt).getTime() < staleBefore;
  }).slice(0, 10);
  await Promise.allSettled(targets.map(resolveOne));
}
