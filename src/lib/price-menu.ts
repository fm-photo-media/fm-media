import type { Service } from "@prisma/client";
import type { BookingOptions } from "@/lib/validation";

// Batch 5 (design.md "Price menu + live total", research: price by square footage, a
// running total). Pure functions, shared by the server pages and the client builder.
// Every price comes from the published Service rows (QA-2).

/** The add-on the first-shoot offer makes free (Legal's terms in promotion.ts). */
export const DRONE_PHOTOS_SLUG = "drone-photos";

/**
 * LEG-14: the first-shoot offer (free drone photos with any photo package) can only be
 * honoured when drone photos and at least one photo package are offered. Otherwise the
 * offer, its terms and its checkbox are not shown (price menu and booking form).
 */
export function firstShootOfferAvailable(packageCount: number, addOnSlugs: readonly string[]) {
  return packageCount > 0 && addOnSlugs.includes(DRONE_PHOTOS_SLUG);
}

export type MenuItem = {
  slug: string;
  title: string;
  price: string;
  amount: number;
  plus: boolean;
  note: string;
};

export type Menu = { packages: MenuItem[]; addOns: MenuItem[]; video: MenuItem[] };

export type MenuChoice = { packageSlug: string; extras: string[]; firstShoot: boolean };

/** "$250-$400+" -> "$250 to $400+", "10-15 photos" -> "10 to 15 photos". */
export function readableRange(value: string) {
  return value.replace(/(\$?\d[\d,]*)\s*[-–]\s*(\$?\d)/g, "$1 to $2");
}

export function displayPrice(service: Pick<Service, "priceLabel" | "startingAt">) {
  if (service.priceLabel) return readableRange(service.priceLabel);
  return service.startingAt > 0 ? `$${service.startingAt}` : "Custom";
}

const sentence = (value: string) => {
  const text = readableRange(value.trim());
  return text && !/[.!?]$/.test(text) ? `${text}.` : text;
};

function toItem(service: Service): MenuItem {
  const note = [service.squareFeet, service.deliverable].filter(Boolean).map((part) => sentence(String(part))).join(" ");
  return {
    slug: service.slug,
    title: service.title,
    price: displayPrice(service),
    amount: service.startingAt,
    plus: /\+/.test(service.priceLabel ?? ""),
    note
  };
}

export function menuItemsFrom(services: Service[]): Menu {
  const of = (category: string) => services.filter((service) => service.category === category).map(toItem);
  return { packages: of("PHOTO"), addOns: of("ADD_ON"), video: of("VIDEO") };
}

export function menuTotal(menu: Menu, choice: MenuChoice) {
  const pkg = menu.packages.find((item) => item.slug === choice.packageSlug);
  const extras = [...menu.addOns, ...menu.video].filter((item) => choice.extras.includes(item.slug));
  const droneFree = Boolean(pkg && choice.firstShoot && extras.some((item) => item.slug === DRONE_PHOTOS_SLUG));
  let amount = pkg?.amount ?? 0;
  for (const item of extras) {
    if (!(droneFree && item.slug === DRONE_PHOTOS_SLUG)) amount += item.amount;
  }
  const plus = Boolean(pkg?.plus || extras.some((item) => item.plus));
  const freeAmount = droneFree ? (extras.find((item) => item.slug === DRONE_PHOTOS_SLUG)?.amount ?? 0) : 0;
  return { amount, label: `$${amount}${plus ? "+" : ""}`, droneFree, freeAmount, pkg, extras };
}

export function bookingHref(choice: MenuChoice) {
  const query = new URLSearchParams();
  if (choice.packageSlug) query.set("package", choice.packageSlug);
  for (const slug of choice.extras) query.append("add", slug);
  if (choice.firstShoot) query.set("first", "1");
  const search = query.toString();
  return `/contact${search ? `?${search}` : ""}#form`;
}

export type BookingPrefill = { photoPackage: string; addOns: string[]; videoServices: string[]; firstShoot: boolean };

/** The builder's choices, read back on /contact. Unknown values are dropped. */
export function prefillFromQuery(query: URLSearchParams, options: BookingOptions): BookingPrefill {
  const known = (list: { value: string }[], value: string) => list.some((option) => option.value === value);
  const pkg = query.get("package") ?? "";
  const adds = query.getAll("add").slice(0, 20);
  return {
    photoPackage: known(options.photoPackages, pkg) ? pkg : "",
    addOns: adds.filter((slug) => known(options.addOns, slug)),
    videoServices: adds.filter((slug) => known(options.videoServices, slug)),
    firstShoot: query.get("first") === "1"
  };
}
