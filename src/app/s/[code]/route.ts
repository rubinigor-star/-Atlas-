import { NextResponse } from "next/server";
import { resolveGenericShortLink } from "@/lib/generic-short-link";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const targetPath = await resolveGenericShortLink(code);
  if (!targetPath) return NextResponse.redirect(new URL("/account/login?error=expired", request.url));
  return NextResponse.redirect(new URL(targetPath, request.url), 302);
}
