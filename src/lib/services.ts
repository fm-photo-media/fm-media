import type { Service } from "@prisma/client";

export const serviceGroups = [
  { key: "PHOTO", title: "Photo Packages", copy: "Fast, polished listing photography sized to the property." },
  { key: "ADD_ON", title: "Add-Ons", copy: "Extra listing assets that help buyers understand location, layout, and scale." },
  { key: "VIDEO", title: "Video Services", copy: "Walkthrough, cinematic, and agent-facing video options for stronger marketing." },
  { key: "DISCOUNT", title: "Discounted / Bundle Rates", copy: "Repeat-listing and bundle pricing for agents with ongoing work." }
] as const;

export function groupServices(services: Service[]) {
  return serviceGroups.map((group) => ({
    ...group,
    services: services.filter((service) => service.category === group.key)
  }));
}

export function servicePrice(service: Service) {
  return service.priceLabel || (service.startingAt > 0 ? `$${service.startingAt}` : "Custom");
}
