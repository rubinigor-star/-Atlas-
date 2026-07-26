import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@fontsource/noto-sans/files/*.woff",
      "./node_modules/@fontsource/noto-sans-hebrew/files/*.woff",
    ],
  },
};

export default nextConfig;
