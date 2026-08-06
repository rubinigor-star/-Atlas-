import { NextResponse } from "next/server";
import {
  createCustomerSessionToken,
  customerSessionCookie,
  customerSessionTtlSeconds,
  verifyCustomerMagicToken,
} from "@/lib/customer-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const session = verifyCustomerMagicToken(token);
  if (!session) return NextResponse.redirect(new URL("/account/login?error=expired", request.url));

  const response = NextResponse.redirect(new URL("/account", request.url));
  response.cookies.set(customerSessionCookie, createCustomerSessionToken(session.email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: customerSessionTtlSeconds,
  });
  return response;
}
