import { NextResponse } from "next/server";
import { walletConfigured } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const REQUIRED = [
  "APPLE_WALLET_PASS_TYPE_ID",
  "APPLE_WALLET_TEAM_ID",
  "APPLE_WALLET_WEB_SERVICE_URL",
  "APPLE_WALLET_SIGNER_CERT_BASE64",
  "APPLE_WALLET_SIGNER_KEY_BASE64",
  "APPLE_WALLET_WWDR_CERT_BASE64",
] as const;

export async function GET() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  const webServiceUrl = process.env.APPLE_WALLET_WEB_SERVICE_URL || null;

  return NextResponse.json(
    {
      service: "atlas-apple-wallet",
      ready: walletConfigured() && missing.length === 0,
      configured: walletConfigured(),
      missing,
      webServiceHttps: Boolean(webServiceUrl?.startsWith("https://")),
      passTypeConfigured: Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID),
      teamConfigured: Boolean(process.env.APPLE_WALLET_TEAM_ID),
      signingCertificateConfigured: Boolean(process.env.APPLE_WALLET_SIGNER_CERT_BASE64),
      signingKeyConfigured: Boolean(process.env.APPLE_WALLET_SIGNER_KEY_BASE64),
      wwdrConfigured: Boolean(process.env.APPLE_WALLET_WWDR_CERT_BASE64),
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
