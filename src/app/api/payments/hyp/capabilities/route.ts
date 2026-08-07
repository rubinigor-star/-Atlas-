import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relay = {
    HYP_RELAY_URL: present("HYP_RELAY_URL"),
    HYP_API_USER: present("HYP_API_USER"),
    HYP_API_PASSWORD: present("HYP_API_PASSWORD"),
    HYP_TERMINAL_NUMBER: present("HYP_TERMINAL_NUMBER") || present("HYP_MASOF"),
    HYP_MPI_MID: present("HYP_MPI_MID") || present("HYP_MID"),
  };

  return NextResponse.json({
    relay,
    relayReady: Object.values(relay).every(Boolean),
    legacyHostedPageReady: present("HYP_MASOF") && present("HYP_API_KEY") && present("HYP_PASSP"),
  });
}
