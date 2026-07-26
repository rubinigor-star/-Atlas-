import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff",
      "./node_modules/@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff",
      "./public/branding/atlas-one-logo-official.jpg.b64",
    ],
  },
};

export default nextConfig;
