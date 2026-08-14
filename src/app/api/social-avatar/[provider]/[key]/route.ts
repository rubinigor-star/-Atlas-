import { NextResponse } from "next/server";

const PROVIDERS = new Set(["instagram", "facebook"]);
const KEY_RE = /^[a-zA-Z0-9._-]{1,100}$/;

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string; key: string }> },
) {
  const { provider, key } = await context.params;
  const normalizedProvider = provider.toLowerCase();
  const normalizedKey = decodeURIComponent(key).trim();

  if (!PROVIDERS.has(normalizedProvider) || !KEY_RE.test(normalizedKey)) {
    return NextResponse.json({ error: "INVALID_SOCIAL_PROFILE" }, { status: 400 });
  }

  const upstream = `https://unavatar.io/${normalizedProvider}/${encodeURIComponent(normalizedKey)}?fallback=false&ttl=28d`;
  const apiKey = process.env.UNAVATAR_API_KEY?.trim();

  try {
    const response = await fetch(upstream, {
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });

    if (!response.ok) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
      });
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 5 * 1024 * 1024) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=2419200, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.info("social_avatar_proxy.failed", {
      provider: normalizedProvider,
      key: normalizedKey,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    });
  }
}
