import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "www.atlas-one.co";
const PUBLIC_OFFICE_PATHS = ["/office/login", "/office/register", "/office/forgot-password", "/office/reset-password"];
const LEGACY_FAVICON_PATHS = new Set(["/favicon.ico", "/favicon.png"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() || "";
  const isVercelHost = host.endsWith(".vercel.app");
  const isProductionDeployment = process.env.VERCEL_ENV === "production";
  const isPublicGet = request.method === "GET" && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/");

  if (LEGACY_FAVICON_PATHS.has(pathname)) {
    const icon = request.nextUrl.clone();
    icon.pathname = "/atlas-app-icon.svg";
    icon.search = "";
    return NextResponse.redirect(icon, 308);
  }

  // Keep Preview deployments on their branch domains. Only the production
  // Vercel alias redirects public traffic to the canonical Atlas domain.
  if (isProductionDeployment && isVercelHost && isPublicGet) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const protectedPath =
    pathname.startsWith("/office/") ||
    pathname === "/office" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin" ||
    pathname.startsWith("/scanner/") ||
    pathname === "/scanner" ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/office/session/");

  if (!protectedPath) return NextResponse.next();
  if (PUBLIC_OFFICE_PATHS.some((path) => pathname.startsWith(path))) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("atlas_office_session")?.value);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/office/session")) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const login = new URL("/office/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
