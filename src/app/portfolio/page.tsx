import type { Metadata } from "next";
import { GalleryGrid } from "@/components/gallery-grid";
import { SectionHeading } from "@/components/section-heading";
import { BUSINESS } from "@/lib/business";
import { getPublishedGalleryImages } from "@/lib/data";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Real estate photography portfolio: homes, apartments and short-term rentals in Chicagoland."
};

export default async function PortfolioPage() {
  const images = await getPublishedGalleryImages();

  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Portfolio"
        title="Property photography with clean light and strong composition."
        copy="A selection of residential and short-term rental work, composed for listing pages and marketing."
        level="h1"
      />
      <div className="mt-10">
        {/* Only Francisco's own uploads show (gallery-visibility.ts). */}
        {images.length ? (
          <GalleryGrid images={images} priorityFirst />
        ) : (
          <p className="max-w-2xl text-base leading-7 text-ink/70">
            Our portfolio is being updated. Questions in the meantime? Call or{" "}
            <a href={`sms:${BUSINESS.phoneE164}`} className="focus-ring font-semibold text-ink underline">
              text
            </a>{" "}
            <a href={`tel:${BUSINESS.phoneE164}`} className="focus-ring font-semibold text-ink underline">
              {BUSINESS.phoneDisplay}
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}
