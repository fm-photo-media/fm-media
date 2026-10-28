import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Batch 5 SEO basics: everything public is crawlable; the admin and the upload API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
