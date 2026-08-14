import { NextResponse } from "next/server";

const PROVIDERS = new Set(["instagram", "facebook"]);
const KEY_RE = /^[a-zA-Z0-9._-]{1,100}$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function decodeHtml(value: string) {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractImage(html: string) {
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
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return null;
}

async function fetchImageBinary(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", ...(headers || {}) },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) return null;
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > 5 * 1024 * 1024) return null;
  return { buffer, contentType };
}

async function instagramImageUrl(username: string) {
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  try {
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: {
        "user-agent": UA,
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.8",
        "x-ig-app-id": "936619743392459",
        referer: profileUrl,
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const json = await response.json() as { data?: { user?: { profile_pic_url_hd?: string | null; profile_pic_url?: string | null } | null } | null };
      const image = json.data?.user?.profile_pic_url_hd || json.data?.user?.profile_pic_url || null;
      if (image) return image;
    }
  } catch {}

  try {
    const response = await fetch(profileUrl, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.8" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const html = (await response.text()).slice(0, 1_500_000);
      const image = extractImage(html);
      if (image) return image;
    }
  } catch {}

  return null;
}

async function facebookImageUrl(key: string) {
  const profileUrl = `https://www.facebook.com/${encodeURIComponent(key)}`;
  try {
    const response = await fetch(profileUrl, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.8" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const html = (await response.text()).slice(0, 1_500_000);
      const image = extractImage(html);
      if (image) return image;
    }
  } catch {}
  return null;
}

function failure(status = 404) {
  return new NextResponse(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string; key: string }> },
) {
  const { provider, key } = await context.params;
  const normalizedProvider = provider.toLowerCase();
  const normalizedKey = decodeURIComponent(key).trim();

  if (!PROVIDERS.has(normalizedProvider) || !KEY_RE.test(normalizedKey)) {
    return NextResponse.json({ error: "INVALID_SOCIAL_PROFILE" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const directUrl = normalizedProvider === "instagram"
      ? await instagramImageUrl(normalizedKey)
      : await facebookImageUrl(normalizedKey);

    if (directUrl) {
      const directImage = await fetchImageBinary(directUrl, normalizedProvider === "instagram" ? { referer: `https://www.instagram.com/${normalizedKey}/` } : undefined).catch(() => null);
      if (directImage) {
        return new NextResponse(directImage.buffer, {
          status: 200,
          headers: {
            "Content-Type": directImage.contentType,
            "Content-Length": String(directImage.buffer.byteLength),
            "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
            "X-Content-Type-Options": "nosniff",
            "X-Atlas-Avatar-Source": "direct",
          },
        });
      }
    }

    const upstream = `https://unavatar.io/${normalizedProvider}/${encodeURIComponent(normalizedKey)}?fallback=false&ttl=28d`;
    const apiKey = process.env.UNAVATAR_API_KEY?.trim();
    const fallbackImage = await fetchImageBinary(upstream, apiKey ? { "x-api-key": apiKey } : undefined).catch(() => null);
    if (fallbackImage) {
      return new NextResponse(fallbackImage.buffer, {
        status: 200,
        headers: {
          "Content-Type": fallbackImage.contentType,
          "Content-Length": String(fallbackImage.buffer.byteLength),
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
          "X-Content-Type-Options": "nosniff",
          "X-Atlas-Avatar-Source": "resolver",
        },
      });
    }

    console.info("social_avatar_proxy.not_found", { provider: normalizedProvider, key: normalizedKey });
    return failure(404);
  } catch (error) {
    console.info("social_avatar_proxy.failed", {
      provider: normalizedProvider,
      key: normalizedKey,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return failure(404);
  }
}
