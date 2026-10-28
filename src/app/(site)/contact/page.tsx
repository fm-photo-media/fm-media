import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { getBookingOptions } from "@/lib/booking-options";
import { BUSINESS } from "@/lib/business";

// QA-2: options and prices come from the published Service rows, like /services.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Book a Shoot",
  description: "Request a real estate photography shoot in Chicagoland for a listing, rental or Airbnb. Call or text (312) 375-5209.",
  alternates: { canonical: "/contact" }
};

// Batch 5 (design.md "Contact and booking"): the call box first (left on desktop, top on a
// phone), then the form in three groups. LEG-2 (batch4-copy section 3) and 4.3 / 4.19: the
// identity facts sit in the call box.
export default async function ContactPage() {
  const options = await getBookingOptions();

  return (
    <main id="main">
      <section className="phead" aria-labelledby="h1">
        <div className="wrap">
          <h1 className="h1" id="h1">
            Book a shoot
          </h1>
          <p className="lede">Text the address, call, or use the form. Francisco confirms every shoot with you before it&apos;s booked.</p>
        </div>
      </section>
      <section className="wrap book" aria-label="Booking">
        <aside className="book__direct" aria-labelledby="direct-h">
          <h2 className="h3" id="direct-h">
            Call or text
          </h2>
          <a className="book__phone fact" href={`tel:${BUSINESS.phoneE164}`}>
            {BUSINESS.phoneDisplay}
          </a>
          <a className="btn" href={`sms:${BUSINESS.phoneE164}`}>
            Text the address
          </a>
          <p className="fact">
            Email{" "}
            <a className="link tap" href={`mailto:${BUSINESS.email}`}>
              {BUSINESS.email}
            </a>
          </p>
          <p className="fact">Serving {BUSINESS.serviceArea}. Appointment times are Chicago time.</p>
          <p className="fact">Owner: {BUSINESS.owner}. Homes, apartments, rentals and Airbnb listings.</p>
          <p className="fact">Delivery: we&apos;ll confirm when to expect your files when we confirm your shoot.</p>
        </aside>
        <ContactForm options={options} />
      </section>
    </main>
  );
}
