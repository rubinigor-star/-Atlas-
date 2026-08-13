import type { MetadataRoute } from "next";
import { getCanonicalOrigin } from "@/lib/public-origin";

export default function robots():MetadataRoute.Robots{
  const base=getCanonicalOrigin();
  return {
    rules:[
      {userAgent:"*",allow:"/",disallow:["/api/"]},
    ],
    sitemap:`${base}/sitemap.xml`,
    host:base,
  };
}
