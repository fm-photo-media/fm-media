import type { Service } from "@prisma/client";
import { displayPrice } from "@/lib/price-menu";

// Batch 5 (DES-21, DES-22): Services and Pricing are one page of real tables, so the old
// card groups and their intros ("location", a single add-on in a 4-column grid) are gone.
export const serviceGroups = [
  { key: "PHOTO", title: "Photo packages" },
  { key: "ADD_ON", title: "Add-ons" },
  { key: "VIDEO", title: "Video" },
  { key: "DISCOUNT", title: "Repeat listings" }
] as const;

export function groupServices(services: Service[]) {
  return serviceGroups.map((group) => ({
    ...group,
    services: services.filter((service) => service.category === group.key)
  }));
}

/** The price as shown on the site ("$250 to $400+"). */
export function servicePrice(service: Service) {
  return displayPrice(service);
}

// Research "do now": neutral until Francisco confirms what every shoot includes.
// Legal (round 1): a video-only shoot has no photo package, so the line is about packages.
export const INCLUDED_LINE =
  "Every photo package includes the edited photos listed for it, ready for the MLS. The delivery time is confirmed when you book.";

/** DES-28 / Legal R5: the DB's discount label, worded as Terms §6 allows (confirmed in the quote). */
export function discountSentence(service: Pick<Service, "priceLabel" | "summary">) {
  const label = service.priceLabel?.trim();
  return label
    ? `Repeat-listing discounts (${label}) are available on some packages and are confirmed in your quote.`
    : service.summary.trim();
}

/** The line under the price menu: the DB's discount rows plus how prices are confirmed. */
export function discountNote(services: Service[]) {
  const discounts = services.filter((service) => service.category === "DISCOUNT").map(discountSentence);
  return [...discounts, "Prices are for typical homes; Francisco confirms the price before the shoot."].join(" ");
}
