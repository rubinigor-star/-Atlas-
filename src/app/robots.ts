import type { MetadataRoute } from "next";

export default function robots():MetadataRoute.Robots{
  return {
    rules:[
      {userAgent:"*",allow:"/",disallow:["/office/","/admin/","/api/","/scanner/","/checkout"]},
    ],
    sitemap:"https://www.atlas-one.co/sitemap.xml",
    host:"https://www.atlas-one.co",
  };
}
