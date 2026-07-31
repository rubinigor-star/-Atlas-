import { NextRequest, NextResponse } from "next/server";

const PUBLIC_OFFICE_PATHS = ["/office/login", "/office/register", "/office/forgot-password", "/office/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never redirect *.vercel.app hosts to production. Every branch preview must
  // remain isolated on its own Vercel URL. Production domain routing is handled
  // by Vercel after changes are merged and deployed from main.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
