import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const PROVIDERS = new Set(["instagram", "facebook"]);
const KEY_RE = /^[a-zA-Z0-9._-]{1,100}$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

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

function avatarCdnScore(url: string) {
  const value = url.toLowerCase();
  let score = 0;
  if (value.includes("t51.2885-19")) score += 100;
  if (value.includes("s150x150")) score += 70;
  if (value.includes("s320x320")) score += 60;
  if (value.includes("profile")) score += 40;
  if (value.includes("cdninstagram.com")) score += 20;
  if (value.includes("fbcdn.net")) score += 20;
  if (value.includes("scontent")) score += 10;
  if (value.includes("sprite") || value.includes("logo")) score -= 100;
  return score;
}

async function headlessProfileImageUrl(provider: string, key: string) {
  const profileUrl = provider === "instagram"
    ? `https://www.instagram.com/${encodeURIComponent(key)}/`
    : `https://www.facebook.com/${encodeURIComponent(key)}`;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { width: 1280, height: 960 },
    });
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.8" });

    const cdnCandidates = new Set<string>();
    page.on("response", (response) => {
      try {
        const url = response.url();
        const host = new URL(url).hostname.toLowerCase();
        if (host.includes("cdninstagram.com") || host.includes("fbcdn.net") || host.startsWith("scontent.")) {
          const type = response.request().resourceType();
          if (type === "image") cdnCandidates.add(url);
        }
      } catch {}
    });

    await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 15000 }).catch(async () => {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
    });
    await new Promise((resolve) => setTimeout(resolve, 2200));

    const domResult = await page.evaluate((profileKey) => {
      const meta = document.querySelector('meta[property="og:image"]')?.getAttribute("content")
        || document.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
      if (meta) return meta;

      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => {
          const src = img.currentSrc || img.getAttribute("src") || "";
          const alt = (img.getAttribute("alt") || "").toLowerCase();
          const rect = img.getBoundingClientRect();
          let score = 0;
          if (alt.includes(profileKey.toLowerCase())) score += 100;
          if (alt.includes("profile") || alt.includes("picture") || alt.includes("photo")) score += 70;
          if (src.includes("t51.2885-19")) score += 100;
          if (rect.width >= 60 && rect.width <= 400 && rect.height >= 60 && rect.height <= 400) score += 25;
          if (Math.abs(rect.width - rect.height) < 15) score += 20;
          return { src, score };
        })
        .filter((item) => Boolean(item.src))
        .sort((a, b) => b.score - a.score);
      return images[0]?.score > 20 ? images[0].src : null;
    }, key);

    if (domResult) return domResult;

    const ranked = [...cdnCandidates]
      .map((url) => ({ url, score: avatarCdnScore(url) }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0]?.score > 20) {
      console.info("social_avatar_proxy.headless_cdn_candidate", { provider, key, score: ranked[0].score, candidates: ranked.length });
      return ranked[0].url;
    }

    console.info("social_avatar_proxy.headless_no_candidate", { provider, key, candidates: ranked.length, finalUrl: page.url() });
    return null;
  } catch (error) {
    console.info("social_avatar_proxy.headless_failed", {
      provider,
      key,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
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

function imageResponse(image: { buffer: ArrayBuffer; contentType: string }, source: string) {
  return new NextResponse(image.buffer, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.buffer.byteLength),
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Atlas-Avatar-Source": source,
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
      if (directImage) return imageResponse(directImage, "direct");
      console.info("social_avatar_proxy.direct_binary_failed", { provider: normalizedProvider, key: normalizedKey });
    } else {
      console.info("social_avatar_proxy.direct_url_missing", { provider: normalizedProvider, key: normalizedKey });
    }

    const headlessUrl = await headlessProfileImageUrl(normalizedProvider, normalizedKey);
    if (headlessUrl) {
      const headlessImage = await fetchImageBinary(headlessUrl, normalizedProvider === "instagram" ? { referer: `https://www.instagram.com/${normalizedKey}/` } : undefined).catch(() => null);
      if (headlessImage) return imageResponse(headlessImage, "headless");
      console.info("social_avatar_proxy.headless_binary_failed", { provider: normalizedProvider, key: normalizedKey });
    } else {
      console.info("social_avatar_proxy.headless_url_missing", { provider: normalizedProvider, key: normalizedKey });
    }

    const upstream = `https://unavatar.io/${normalizedProvider}/${encodeURIComponent(normalizedKey)}?fallback=false&ttl=28d`;
    const apiKey = process.env.UNAVATAR_API_KEY?.trim();
    const resolverImage = await fetchImageBinary(upstream, apiKey ? { "x-api-key": apiKey } : undefined).catch(() => null);
    if (resolverImage) return imageResponse(resolverImage, "resolver");

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
