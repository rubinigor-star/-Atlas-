import { NextRequest, NextResponse } from "next/server";

const PUBLIC_OFFICE_PATHS = ["/office/login", "/office/register", "/office/forgot-password", "/office/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_OFFICE_PATHS.some(path => pathname.startsWith(path))) return NextResponse.next();
  const hasSession = Boolean(request.cookies.get("atlas_office_session")?.value);
  if (hasSession) return NextResponse.next();
  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/office/session")) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const login = new URL("/office/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/office/:path*", "/admin/:path*", "/scanner/:path*", "/api/admin/:path*", "/api/office/session/:path*"],
};
