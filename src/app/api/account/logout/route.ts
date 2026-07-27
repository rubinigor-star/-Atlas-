import { NextResponse } from "next/server";
import { clearCustomerSession } from "@/lib/customer-auth";

export async function POST(request: Request) {
  await clearCustomerSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
