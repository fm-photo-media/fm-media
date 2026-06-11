import Image from "next/image";
import Link from "next/link";
import { GalleryGrid } from "@/components/gallery-grid";
import { PricingCard } from "@/components/pricing-card";
import { PromoCallout } from "@/components/promo-callout";
import { SectionHeading } from "@/components/section-heading";
import { getFeaturedGalleryImages, getPublishedServices } from "@/lib/data";

export const revalidate = 3600;

export default async function HomePage() {
  const [images, services] = await Promise.all([getFeaturedGalleryImages(3), getPublishedServices()]);
  const featuredServices = services.filter((service) => service.featured).slice(0, 4);
  const homepageServices = featuredServices.length ? featuredServices : services.slice(0, 4);

  return (
    <main>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Real estate photography</p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
              Listing media that helps properties move faster.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink/70 sm:text-lg sm:leading-8">
              Fast, professional real estate photos, drone media, walkthrough videos, cinematic edits, and floor plan add-ons for agents, property managers, Airbnb hosts, and homeowners.
            </p>
            <div className="mt-5 max-w-xl">
              <PromoCallout compact />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="focus-ring w-full rounded-full bg-ink px-6 py-3 text-center text-sm font-semibold text-white hover:bg-clay sm:w-auto">
                Book a Shoot
              </Link>
              <Link href="/services" className="focus-ring w-full rounded-full border border-line bg-white px-6 py-3 text-center text-sm font-semibold text-ink hover:border-clay sm:w-auto">
                View Packages
              </Link>
              <Link href="/contact" className="focus-ring w-full rounded-full border border-line bg-white px-6 py-3 text-center text-sm font-semibold text-ink hover:border-clay sm:w-auto">
                Request a Custom Bundle
              </Link>
            </div>
          </div>
          <div className="relative min-h-[280px] overflow-hidden rounded-lg shadow-soft sm:min-h-[380px] lg:min-h-[420px]">
            <Image
              src="/images/portfolio/real-estate-photo-01.jpg"
              alt="Front exterior real estate photo of a two-story home with porch"
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["$100+", "photo packages sized for condos, homes, and larger properties"],
            ["Drone", "aerial photos and short drone video for stronger listing context"],
            ["Bundle", "discounted rates for repeat listings and ongoing realtor work"]
          ].map(([stat, label]) => (
            <div key={stat} className="border-t border-line pt-5">
              <p className="font-serif text-4xl text-clay">{stat}</p>
              <p className="mt-2 text-sm leading-6 text-ink/70">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-mist">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Services"
            title="Photos, video, drone, and floor plans in one booking flow."
            copy="Start with the right photo package, then add the listing media that helps buyers understand the property before they arrive."
          />
          <div className="mt-6">
            <PromoCallout compact />
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {homepageServices.map((service) => (
              <PricingCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading eyebrow="Portfolio" title="Bright, composed, listing-ready." />
          <Link href="/portfolio" className="focus-ring text-sm font-semibold text-clay hover:text-ink">
            See the full gallery
          </Link>
        </div>
        <div className="mt-8">
          <GalleryGrid images={images} />
        </div>
      </section>
    </main>
  );
}
