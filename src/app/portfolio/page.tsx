import type { Metadata } from "next";
import { GalleryGrid } from "@/components/gallery-grid";
import { SectionHeading } from "@/components/section-heading";
import { getPublishedGalleryImages } from "@/lib/data";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Real estate photography portfolio for homes, apartments, short-term rentals, and commercial spaces."
};

export default async function PortfolioPage() {
  const images = await getPublishedGalleryImages();

  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Portfolio"
        title="Property photography with clean light and strong composition."
        copy="A selection of residential, short-term rental, twilight, and commercial work composed for listing pages and marketing campaigns."
        level="h1"
      />
      <div className="mt-10">
        <GalleryGrid images={images} priorityFirst />
      </div>
    </main>
  );
}
