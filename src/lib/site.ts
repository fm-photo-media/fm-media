// The canonical public URL, used by the sitemap, robots.txt and the business JSON-LD.
export const SITE_URL = "https://fm-media.org";

// metadataBase (absolute share-image URLs) may follow NEXT_PUBLIC_SITE_URL on previews.
export const METADATA_BASE = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, "");

/** The public pages, for the sitemap (privacy and terms included, per Legal). */
export const PUBLIC_PAGES = ["/", "/services", "/portfolio", "/about", "/contact", "/privacy", "/terms"] as const;

/** The primary navigation (design.md: one "Book a shoot", Pricing merged into Services). */
export const NAV = [
  { href: "/services", label: "Services and pricing" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Book a shoot" }
] as const;

/**
 * DES-24 / Legal R4: About shows a portrait only once Francisco sends one. Set this to a
 * local path (for example "/images/francisco.jpg") then; until then there is no slot and
 * no placeholder text.
 */
export const PORTRAIT_URL: string | null = null;
