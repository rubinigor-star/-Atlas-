import { NextResponse } from "next/server";
import { createCustomerSession, verifyCustomerMagicToken } from "@/lib/customer-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const session = verifyCustomerMagicToken(token);
  if (!session) return NextResponse.redirect(new URL("/account/login?error=expired", request.url));
  await createCustomerSession(session.email);
  return NextResponse.redirect(new URL("/account", request.url));
}
