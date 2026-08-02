import { atlasLogoSvg } from "@/lib/atlas-brand";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dark = url.searchParams.get("dark") === "1";
  return new Response(atlasLogoSvg({ dark }), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
