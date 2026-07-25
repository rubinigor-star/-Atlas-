import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@fontsource/noto-sans/files/*.woff",
      "./node_modules/@fontsource/noto-sans/files/*.woff2",
      "./node_modules/@fontsource/noto-sans-hebrew/files/*.woff",
      "./node_modules/@fontsource/noto-sans-hebrew/files/*.woff2",
    ],
  },
};

export default nextConfig;
