import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/lib/public-origin";

export default function robots(): MetadataRoute.Robots {
  const base=getPublicOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/office/",
          "/admin/",
          "/api/",
          "/scanner/",
          "/checkout",
          "/account/",
          "/orders/",
          "/payments/",
          "/platform/",
          "/promoter/",
          "/cancel-order/",
          "/cancellation-email-preview/",
          "/ticket-design-preview/",
          "/p/",
          "/g/",
          "/s/",
          "/t/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
