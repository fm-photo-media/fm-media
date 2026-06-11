import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PromoCallout } from "@/components/promo-callout";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Contact & Booking",
  description: "Book a real estate photography shoot for a listing, rental, Airbnb, or commercial property."
};

export default function ContactPage() {
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-14">
      <div>
        <SectionHeading
          eyebrow="Book"
          title="Tell us about the property."
          copy="Share the address, preferred timing, and shoot type. We will review the details and follow up with availability."
          level="h1"
        />
        <dl className="mt-8 grid gap-5 text-sm text-ink/70">
          <div>
            <dt className="font-semibold text-ink">Typical delivery</dt>
            <dd className="mt-1">Next business day for most residential shoots.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Coverage area</dt>
            <dd className="mt-1">Homes, apartments, rentals, Airbnb listings, retail, offices, and hospitality spaces.</dd>
          </div>
        </dl>
        <div className="mt-8">
          <PromoCallout compact />
        </div>
      </div>
      <ContactForm />
    </main>
  );
}
