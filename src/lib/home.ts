import type { Service } from "@prisma/client";
import { readableRange } from "@/lib/price-menu";

// Batch 8 (design.md "Build spec: Variant B", "The photo decision"). Pure helpers for the
// home page and the price sentence, so the hero state and the copy are tested.

type HeroPhoto = { category: string };

/**
 * The home hero is "photo" only when one of Francisco's own featured uploads exists (the
 * caller passes getFeaturedGalleryImages(), which has already dropped repo samples and
 * stock links). It prefers a featured exterior, else the first featured photo; the next
 * photo goes under the price sentence. With none, the hero is the name ("name") and no
 * picture of any kind is drawn.
 */
export function homeHero<T extends HeroPhoto>(photos: readonly T[]) {
  const hero = photos.find((photo) => /exterior/i.test(photo.category)) ?? photos[0];
  const interior = hero ? photos.find((photo) => photo !== hero) : undefined;
  return { mode: hero ? ("photo" as const) : ("name" as const), hero, interior };
}

type PackageFields = Pick<Service, "title" | "category" | "startingAt" | "squareFeet" | "deliverable">;

/** The cheapest priced photo package (the "from $X" on home and in the price sentence). */
export function lowestPackage<T extends PackageFields>(services: readonly T[]): T | undefined {
  return services
    .filter((service) => service.category === "PHOTO" && service.startingAt > 0)
    .reduce<T | undefined>((low, service) => (!low || service.startingAt < low.startingAt ? service : low), undefined);
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * "Basic covers a home up to 1,500 sq ft with 10 to 15 edited photos." Built from the DB's
 * own fields (readableRange for the ranges); "professionally" is dropped to keep the
 * sentence short, as in the mockup. Nothing is added that the row doesn't say.
 */
export function packageLine(service: PackageFields | undefined) {
  if (!service) return "";
  const size = service.squareFeet?.trim();
  const gets = readableRange((service.deliverable ?? "").trim())
    .replace(/\bprofessionally\s+/i, "")
    .replace(/[.!?]$/, "");
  if (size && gets) return `${service.title} covers a home ${lowerFirst(size)} with ${gets}.`;
  if (gets) return `${service.title} comes with ${gets}.`;
  return "";
}

/** The price sentence's figure: the lowest package amount, or null to print a plain title. */
export function priceHeadline(packages: readonly { amount: number }[]) {
  const amounts = packages.map((item) => item.amount).filter((amount) => amount > 0);
  return { lowest: amounts.length ? Math.min(...amounts) : null };
}
