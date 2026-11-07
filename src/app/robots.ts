import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/s/"], disallow: ["/api/", "/admin"] }],
    sitemap: "https://amanaija.vercel.app/sitemap.xml",
  };
}
