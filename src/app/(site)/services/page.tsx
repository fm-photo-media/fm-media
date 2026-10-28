import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { PriceMenu } from "@/components/price-menu";
import { BUSINESS } from "@/lib/business";
import { getFeaturedGalleryImages, getPublishedServices } from "@/lib/data";
import { menuItemsFrom } from "@/lib/price-menu";
import { INCLUDED_LINE, discountNote } from "@/lib/services";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Services and Pricing",
  description:
    "Real estate photo packages priced by square footage, plus drone, video and floor plans, for listings and rentals in Chicagoland.",
  alternates: { canonical: "/services" }
};

// Batch 5 (design.md "Services and pricing"; DES-9, DES-21, DES-22): one page built from the
// published Service rows (QA-2). /pricing 308-redirects here (next.config.mjs).
// Batch 7 (design.md "Final whole-site review", change 2; DES-34): one price list, not two.
// The three tables are gone; the price menu sits under the h1. It already carries every row
// with its home size, edited photos (or what the add-on is) and price, the offer once with
// its terms, and the live total. The side panel moves beside it, and Legal's repeat-discount
// sentence and the "every photo package includes" line stay under it.
export default async function ServicesPage() {
  const [services, photos] = await Promise.all([getPublishedServices(), getFeaturedGalleryImages(2)]);
  // One photo at most here: the second featured upload (the first is the home hero).
  const sidePhoto = photos[1] ?? photos[0];

  return (
    <main id="main">
      <section className="phead" aria-labelledby="h1">
        <div className="wrap">
          <h1 className="h1" id="h1">
            Services and pricing
          </h1>
          <p className="lede">Every package is priced by the home&apos;s square footage. Francisco confirms the price with you before the shoot.</p>
        </div>
      </section>

      <PriceMenu
        menu={menuItemsFrom(services)}
        footnote={[discountNote(services), INCLUDED_LINE]}
        className="prices--lead"
        aside={
          <aside className="prices__aside" aria-label="Not sure which package fits?">
            {sidePhoto ? (
              <Photo src={sidePhoto.imageUrl} alt={sidePhoto.alt} sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 30vw" />
            ) : null}
            <p>Not sure which package fits? Send the address and the square footage, and Francisco will tell you.</p>
            <Link className="btn" href="/contact#form">
              Book a shoot
            </Link>
            <a className="link link--blue tap" href={`sms:${BUSINESS.phoneE164}`}>
              Text {BUSINESS.phoneDisplay}
            </a>
          </aside>
        }
      />
    </main>
  );
}
