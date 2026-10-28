import type { MetadataRoute } from "next";
import { hasPublicPortfolio } from "@/lib/data";
import { sitemapEntries } from "@/lib/site";

// Batch 5 SEO basics: the public pages, /privacy and /terms included (Legal batch 4).
// Batch 7: /portfolio is listed only once it has a public photo (site.ts sitemapEntries).
// Gallery edits revalidate it (actions.ts revalidateGalleryPages); hourly otherwise.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(await hasPublicPortfolio());
}
