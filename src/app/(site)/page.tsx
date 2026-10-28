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
  title: { absolute: "FM Media | Chicagoland Listing Photos" },
  description:
    "Listing photos, drone, video and floor plans for real estate agents across Chicagoland. Photo packages priced by square footage.",
  alternates: { canonical: "/" }
};

// Batch 5 (design.md "Home"): split hero (who, where, how to reach him, from $100), the
// price menu with the live total, and "How a shoot goes". Two photo slots, filled only by
// Francisco's own featured uploads (hero exterior, then one interior); without them the
// hero shows the no-photo panel and the price menu shows none. No home portfolio row.
export default async function HomePage() {
  const [photos, services] = await Promise.all([getFeaturedGalleryImages(6), getPublishedServices()]);
  // The hero prefers a featured exterior; the price menu takes the next featured photo.
  const hero = photos.find((photo) => /exterior/i.test(photo.category)) ?? photos[0];
  const interior = photos.find((photo) => photo !== hero);
  const menu = menuItemsFrom(services);
  const lowest = menu.packages.length ? Math.min(...menu.packages.map((item) => item.amount)) : 0;

  return (
    <main id="main">
      <section className="hero" aria-labelledby="h1">
        <div className="wrap hero__grid">
          <div className="hero__text">
            <h1 className="h1" id="h1">
              Chicagoland
              <br />
              listing photos
            </h1>
            <p className="lede">
              Photos, drone, video and floor plans for real estate agents. You book directly with the owner, {BUSINESS.owner}.
            </p>
            {lowest > 0 ? <p className="fact hero__price">Photo packages from ${lowest}, priced by square footage.</p> : null}
            <div className="hero__act">
              <Link className="btn" href="/contact#form">
                Book a shoot
              </Link>
              {/* DES-29: sms: only where it works (touch screens); one tel: link on desktop.
                  DES-37: with no photo, the blue facts field carries the number, so these go. */}
              {hero ? (
                <>
                  <span className="fact touch-only">
                    <a className="link link--blue tap" href={`tel:${BUSINESS.phoneE164}`}>
                      Call
                    </a>
                    &nbsp;or&nbsp;
                    <a className="link link--blue tap" href={`sms:${BUSINESS.phoneE164}`}>
                      text {BUSINESS.phoneDisplay}
                    </a>
                  </span>
                  <span className="fact fine-only">
                    <a className="link link--blue tap" href={`tel:${BUSINESS.phoneE164}`}>
                      Call or text {BUSINESS.phoneDisplay}
                    </a>
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {hero ? (
            <Photo className="hero__photo" src={hero.imageUrl} alt={hero.alt} priority sizes="(max-width: 640px) 100vw, 58vw" />
          ) : (
            // DES-23: no photo of his own yet, so the slot carries the facts, not a second logo.
            <div className="ph ph--32 hero__photo hero-facts on-blue">
              <p className="hero-facts__label">Call or text</p>
              <a className="hero-facts__phone" href={`tel:${BUSINESS.phoneE164}`}>
                {BUSINESS.phoneDisplay}
              </a>
              <p>Serving {BUSINESS.serviceArea}</p>
              <a className="btn btn--paper touch-only" href={`sms:${BUSINESS.phoneE164}`}>
                Text the address
              </a>
            </div>
          )}
        </div>
      </section>

      <PriceMenu
        menu={menu}
        footnote={discountNote(services)}
        aside={interior ? <Photo src={interior.imageUrl} alt={interior.alt} sizes="(max-width: 1000px) 100vw, 33vw" /> : null}
      />

      <section className="wrap how section" aria-labelledby="how-h">
        <h2 className="h2" id="how-h">
          How a shoot goes
        </h2>
        <div className="how__steps">
          <div>
            <h3 className="h3">You send the listing</h3>
            <p>The address, the square footage and a day that works, by text, a call or the booking form.</p>
          </div>
          <div>
            <h3 className="h3">Francisco confirms, then we shoot</h3>
            <p>He confirms the time and the price with you by phone, text or email. Then we photograph the home.</p>
          </div>
          <div>
            <h3 className="h3">You get the photos</h3>
            <p>Edited and ready for the MLS. The delivery time is confirmed when you book.</p>
          </div>
        </div>
        <p className="fact how__incl">{INCLUDED_LINE}</p>
      </section>
    </main>
  );
}

