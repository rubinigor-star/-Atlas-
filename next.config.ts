import type { NextConfig } from "next";

const noIndexHeader = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff",
      "./node_modules/@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff",
      "./public/branding/atlas-one-logo.jpg",
    ],
  },
  async headers() {
    if (process.env.VERCEL_ENV === "preview") {
      return [{ source: "/:path*", headers: noIndexHeader }];
    }

    const privateRoots = [
      "account",
      "admin",
      "cancel-order",
      "cancellation-email-preview",
      "checkout",
      "office",
      "orders",
      "payments",
      "platform",
      "promoter",
      "scanner",
      "ticket-design-preview",
      "p",
      "g",
      "s",
      "t",
    ];

    return privateRoots.map((root) => ({
      source: `/${root}/:path*`,
      headers: noIndexHeader,
    }));
  },
};

export default nextConfig;
