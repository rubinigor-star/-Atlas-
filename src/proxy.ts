import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "www.atlas-one.co";
const PREVIEW_04_HOST = "atlas-git-preview-04-atlasteam1.vercel.app";
const PUBLIC_OFFICE_PATHS = ["/office/login", "/office/register", "/office/forgot-password", "/office/reset-password", "/office/invite"];
const LEGACY_FAVICON_PATHS = new Set(["/favicon.ico", "/favicon.png"]);
const HYP_CHECKOUT_CSP = "frame-src 'self' https://pay.hyp.co.il https://*.creditguard.co.il;";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() || "";
  const isVercelHost = host.endsWith(".vercel.app");
  const isProductionDeployment = process.env.VERCEL_ENV === "production";
  const isPreview04 = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "preview-04";
  const isPublicGet = request.method === "GET" && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/");

  if (isPreview04 && isVercelHost && host !== PREVIEW_04_HOST && isPublicGet) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = PREVIEW_04_HOST;
    url.port = "";
    return NextResponse.redirect(url, 307);
  }

  if (LEGACY_FAVICON_PATHS.has(pathname)) {
    const icon = request.nextUrl.clone();
    icon.pathname = "/atlas-app-icon.svg";
    icon.search = "";
    return NextResponse.redirect(icon, 308);
  }

  if (pathname === "/api/payments/hyp/order") {
    const code = request.nextUrl.searchParams.get("CCode") || request.nextUrl.searchParams.get("code") || "";
    if (code === "800" || code === "700") {
      const approval = request.nextUrl.clone();
      approval.pathname = "/api/payments/hyp/approval";
      return NextResponse.redirect(approval, 307);
    }
  }

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

  if (!protectedPath) {
    const response = NextResponse.next();
    if (pathname === "/checkout") response.headers.set("Content-Security-Policy", HYP_CHECKOUT_CSP);
    return response;
  }
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
