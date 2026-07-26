import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/tickets/*/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/ticket-pdf-test": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
