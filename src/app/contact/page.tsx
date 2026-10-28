import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PromoCallout } from "@/components/promo-callout";
import { SectionHeading } from "@/components/section-heading";
import { getBookingOptions } from "@/lib/booking-options";
import { BUSINESS } from "@/lib/business";

// QA-2: options and prices come from the published Service rows, like /pricing.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact & Booking",
  description: "Request a real estate photography shoot in Chicagoland for a listing, rental or Airbnb."
};

const linkClass = "focus-ring font-semibold text-ink underline";

export default async function ContactPage() {
  const options = await getBookingOptions();

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-14">
      <div>
        <SectionHeading
          eyebrow="Book"
          title="Tell us about the property."
          copy="Share the address, preferred timing, and shoot type. We will review the details and follow up with availability."
          level="h1"
        />
        {/* LEG-2 (batch4-copy section 3) and 4.3 / 4.19. */}
        <dl className="mt-8 grid gap-5 text-sm text-ink/70">
          <div>
            <dt className="font-semibold text-ink">Service area</dt>
            <dd className="mt-1">{BUSINESS.serviceArea}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Call or text</dt>
            <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <a href={`tel:${BUSINESS.phoneE164}`} className={linkClass}>
                {BUSINESS.phoneDisplay}
              </a>
              <a href={`sms:${BUSINESS.phoneE164}`} className={linkClass}>
                Send a text
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Email</dt>
            <dd className="mt-1">
              <a href={`mailto:${BUSINESS.email}`} className={linkClass}>
                {BUSINESS.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Owner</dt>
            <dd className="mt-1">{BUSINESS.owner}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Property types</dt>
            <dd className="mt-1">Homes, apartments, rentals and Airbnb listings.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Delivery</dt>
            <dd className="mt-1">We&apos;ll confirm when to expect your files when we confirm your shoot.</dd>
          </div>
        </dl>
        <div className="mt-8">
          <PromoCallout />
        </div>
      </div>
      <ContactForm options={options} />
    </main>
  );
}
