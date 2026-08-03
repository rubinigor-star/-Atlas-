import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  try {
    await requirePermission("ORDER_MANAGE");

    const relayUrl = process.env.HYP_RELAY_URL?.trim() || "";
    const userConfigured = present("HYP_RELAY_USER") || present("HYP_API_USER");
    const passwordConfigured = present("HYP_RELAY_PASSWORD") || present("HYP_API_PASSWORD");
    const terminalConfigured = present("HYP_MASOF");
    const validHttpsUrl = /^https:\/\//i.test(relayUrl);
    const configured = validHttpsUrl && userConfigured && passwordConfigured && terminalConfigured;

    return NextResponse.json({
      ok: true,
      configured,
      checks: {
        relayUrl: validHttpsUrl,
        relayUser: userConfigured,
        relayPassword: passwordConfigured,
        terminal: terminalConfigured,
      },
      message: configured
        ? "HYP Relay refund configuration is present."
        : "Refunds require the production HYP Relay URL and production Relay API username/password supplied by HYP.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 },
    );
  }
}
