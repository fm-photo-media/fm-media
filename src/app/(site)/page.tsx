import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { PriceMenu } from "@/components/price-menu";
import { BUSINESS } from "@/lib/business";
import { getFeaturedGalleryImages, getPublishedServices } from "@/lib/data";
import { homeHero, lowestPackage, packageLine } from "@/lib/home";
import { menuItemsFrom } from "@/lib/price-menu";
import { discountNote } from "@/lib/services";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "FM Media | Chicagoland Listing Photos" },
  description:
    "Listing photos, drone, video and floor plans for real estate agents across Chicagoland. Photo packages priced by square footage.",
  alternates: { canonical: "/" }
};

// Batch 8 (design.md "Build spec: Variant B", "Home"): the name as a monument. The hero is
// hero--photo only when one of Francisco's own featured uploads exists (home.ts homeHero);
// otherwise hero--name, with no photo row, box, panel or second logo. Then the price
// sentence and list on the tint field, "How a shoot goes", and the one-word BOOK band.
export default async function HomePage() {
  const [photos, services] = await Promise.all([getFeaturedGalleryImages(6), getPublishedServices()]);
  const { mode, hero, interior } = homeHero(photos);
  const menu = menuItemsFrom(services);
  const low = lowestPackage(services);
  const line = packageLine(low);

  return (
    <main id="main">
      <section className={`hero hero--${mode}`} aria-labelledby="h1">
        {hero ? (
          <figure className="ph hero__photo">
            <Image src={hero.imageUrl} alt={hero.alt} fill priority sizes="100vw" />
          </figure>
        ) : null}
        <h1 className="mon mon--settle wrap" id="h1">
          FM Media<span className="vh">: Chicagoland listing photos</span>
        </h1>
        <div className="wrap hero__row">
          <div className="hero__say">
            <p className="lede">
              Listing photos, drone, video and floor plans for agents across {BUSINESS.serviceArea}, booked directly with the owner,{" "}
              {BUSINESS.owner}.
            </p>
            {low ? <p className="fact">Photo packages from ${low.startingAt}, priced by square footage.</p> : null}
          </div>
          <div className="hero__act">
            {/* DES-29: sms: only where it works (touch screens); one tel: link on desktop. */}
            <span className="fact touch-only">
              <a className="link link--blue tap" href={`tel:${BUSINESS.phoneE164}`}>
                Call
              </a>
              &nbsp;or&nbsp;
              <a className="link link--blue tap" href={`sms:${BUSINESS.phoneE164}`}>
                text {BUSINESS.phoneDisplay}
              </a>
            </span>
            <a className="link link--blue tap fact fine-only" href={`tel:${BUSINESS.phoneE164}`}>
              Call or text {BUSINESS.phoneDisplay}
            </a>
            <Link className="btn" href="/contact#form">
              Book a shoot
            </Link>
          </div>
        </div>
      </section>

      <PriceMenu
        menu={menu}
        heading="h2"
        footnote={discountNote(services)}
        under={
          <>
            {interior ? <Photo src={interior.imageUrl} alt={interior.alt} sizes="(max-width: 1000px) 100vw, 40vw" /> : null}
            <p>{line ? `${line} ` : ""}Tick what the listing needs and the total adds itself up.</p>
            <div className={interior ? "act below" : "act"}>
              <Link className="btn" href="/contact#form">
                Book a shoot
              </Link>
            </div>
          </>
        }
      />

      <section className="wrap how" aria-labelledby="how-h">
        <h2 className="h2" id="how-h">
          How a shoot goes
        </h2>
        <ol className="how__steps">
          <li>
            <h3 className="h3">You send the listing</h3>
            <p>The address, the square footage and a day that works, by text, a call or the booking form.</p>
          </li>
          <li>
            <h3 className="h3">Francisco confirms, then we shoot</h3>
            <p>He confirms the time and the price with you by phone, text or email. Then we photograph the home.</p>
          </li>
          <li>
            <h3 className="h3">You get the photos</h3>
            <p>Edited and ready for the MLS. The delivery time is confirmed when you book.</p>
          </li>
        </ol>
      </section>

      {/* The band is one link: its name is the sentence plus "Book" (no block elements inside). */}
      <Link className="band on-blue" href="/contact#form">
        <span className="wrap">
          <span className="band__top">
            <span className="band__say">
              Send the address, the square footage and a day that works. Francisco confirms the time and the price with you.
            </span>
            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path d="M12 36 36 12M16 12h20v20" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
          </span>
          <span className="band__word" role="heading" aria-level={2}>
            Book
          </span>
        </span>
      </Link>
    </main>
  );
}
