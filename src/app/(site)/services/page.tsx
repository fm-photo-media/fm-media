import type { Metadata } from "next";
import Link from "next/link";
import { PriceMenu } from "@/components/price-menu";
import { BUSINESS } from "@/lib/business";
import { getPublishedServices } from "@/lib/data";
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
// Batch 7 (DES-34): one price list, not two.
// Batch 8 (design.md "Build spec: Variant B", "Services"): the whole page is the price
// section, its sentence the h1. No photo here: the help block takes the right column.
// DES-50: the sms: link is touch-only; fine pointers get one tel: "Call or text".
export default async function ServicesPage() {
  const services = await getPublishedServices();

  return (
    <main id="main">
      <PriceMenu
        menu={menuItemsFrom(services)}
        heading="h1"
        headingId="h1"
        className="prices--first"
        footnote={[discountNote(services), INCLUDED_LINE]}
        under={
          <>
            <p>Every package is priced by the home&apos;s square footage. Francisco confirms the price with you before the shoot.</p>
            <div className="help">
              <p>Not sure which package fits? Send the address and the square footage, and Francisco will tell you.</p>
              <div className="act">
                <Link className="btn" href="/contact#form">
                  Book a shoot
                </Link>
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
              </div>
            </div>
          </>
        }
      />
    </main>
  );
}
