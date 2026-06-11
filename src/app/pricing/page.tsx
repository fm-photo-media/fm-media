import type { Metadata } from "next";
import Link from "next/link";
import { PricingCard } from "@/components/pricing-card";
import { PromoCallout } from "@/components/promo-callout";
import { SectionHeading } from "@/components/section-heading";
import { getPublishedServices } from "@/lib/data";
import { groupServices } from "@/lib/services";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pricing",
  description: "Real estate photography pricing for photo packages, drone add-ons, floor plans, walkthrough videos, and bundle rates."
};

export default async function PricingPage() {
  const services = await getPublishedServices();
  const groups = groupServices(services);

  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Pricing"
        title="Clear packages for listing photos, drone, video, and floor plans."
        copy="Choose a photo package by property size, then add aerials, video, floor plans, or bundle pricing for repeat listings."
        level="h1"
      />
      <div className="mt-8">
        <PromoCallout />
      </div>
      <div className="mt-10 grid gap-10">
        {groups.map((group) =>
          group.services.length ? (
            <section key={group.key} aria-labelledby={`${group.key.toLowerCase()}-pricing`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id={`${group.key.toLowerCase()}-pricing`} className="font-serif text-3xl text-ink">
                    {group.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">{group.copy}</p>
                </div>
                {group.key === "DISCOUNT" ? (
                  <Link href="/contact" className="focus-ring text-sm font-semibold text-clay hover:text-ink">
                    Request a Custom Bundle
                  </Link>
                ) : null}
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {group.services.map((service) => (
                  <PricingCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          ) : null
        )}
      </div>
    </main>
  );
}
