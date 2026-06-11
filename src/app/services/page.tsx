import type { Metadata } from "next";
import Link from "next/link";
import { PricingCard } from "@/components/pricing-card";
import { PromoCallout } from "@/components/promo-callout";
import { SectionHeading } from "@/components/section-heading";
import { getPublishedServices } from "@/lib/data";
import { groupServices } from "@/lib/services";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Services",
  description: "Real estate photography services for listings, rentals, twilight exteriors, and commercial properties."
};

export default async function ServicesPage() {
  const services = await getPublishedServices();
  const groups = groupServices(services);

  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Services"
        title="Listing media services for agents, hosts, and property teams."
        copy="Photo packages, drone media, floor plans, and video options built to help listings look clear, professional, and ready to market."
        level="h1"
      />
      <div className="mt-8">
        <PromoCallout />
      </div>
      <div className="mt-10 grid gap-10">
        {groups.slice(0, 3).map((group) =>
          group.services.length ? (
            <section key={group.key}>
              <h2 className="font-serif text-3xl text-ink">{group.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">{group.copy}</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {group.services.map((service) => (
                  <PricingCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          ) : null
        )}
      </div>
      <div className="mt-10 rounded-lg bg-ink p-8 text-white">
        <h2 className="font-serif text-3xl">Need a custom commercial scope?</h2>
        <p className="mt-3 max-w-2xl text-white/75">
          Multi-site shoots, hospitality refreshes, leasing campaigns, and builder packages can be quoted by usage and schedule.
        </p>
        <Link href="/contact" className="focus-ring mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">
          Request a Quote
        </Link>
      </div>
    </main>
  );
}
