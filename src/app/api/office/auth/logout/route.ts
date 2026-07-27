import { NextResponse } from "next/server";
import { clearOfficeSession } from "@/lib/auth";

export async function POST(request: Request) {
  await clearOfficeSession();
  return NextResponse.redirect(new URL("/office/login", request.url), 303);
}
