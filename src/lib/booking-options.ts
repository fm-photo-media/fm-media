import type { Service } from "@prisma/client";
import { getPublishedServices } from "@/lib/data";
import { displayPrice } from "@/lib/price-menu";
import type { BookingOption, BookingOptions } from "@/lib/validation";

// QA-2: the booking form shows the same published Service rows as /services.
// `label` is what gets stored with the inquiry (unchanged since batch 2: "Basic - $100");
// `display` is the batch 5 wording the form shows ("Basic, up to 1,500 sq ft · $100").
function rawPrice(service: Service) {
  return service.priceLabel || (service.startingAt > 0 ? `$${service.startingAt}` : "Custom");
}

function toOption(service: Service): BookingOption {
  const size = service.category === "PHOTO" && service.squareFeet ? `, ${service.squareFeet.charAt(0).toLowerCase()}${service.squareFeet.slice(1)}` : "";
  return {
    value: service.slug,
    label: `${service.title} - ${rawPrice(service)}`,
    display: `${service.title}${size} · ${displayPrice(service)}`
  };
}

export function bookingOptionsFrom(services: Service[]): BookingOptions {
  const of = (category: string) => services.filter((service) => service.category === category).map(toOption);
  return { photoPackages: of("PHOTO"), addOns: of("ADD_ON"), videoServices: of("VIDEO") };
}

export async function getBookingOptions() {
  return bookingOptionsFrom(await getPublishedServices());
}
