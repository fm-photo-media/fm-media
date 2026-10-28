import type { Service } from "@prisma/client";
import { getPublishedServices } from "@/lib/data";
import { servicePrice } from "@/lib/services";
import type { BookingOption, BookingOptions } from "@/lib/validation";

// QA-2: the booking form shows the same published Service rows as /pricing.
function toOption(service: Service): BookingOption {
  return { value: service.slug, label: `${service.title} - ${servicePrice(service)}` };
}

export function bookingOptionsFrom(services: Service[]): BookingOptions {
  const of = (category: string) => services.filter((service) => service.category === category).map(toOption);
  return { photoPackages: of("PHOTO"), addOns: of("ADD_ON"), videoServices: of("VIDEO") };
}

export async function getBookingOptions() {
  return bookingOptionsFrom(await getPublishedServices());
}
