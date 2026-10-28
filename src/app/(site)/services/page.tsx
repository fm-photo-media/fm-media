import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { PriceMenu } from "@/components/price-menu";
import { BUSINESS } from "@/lib/business";
import { getFeaturedGalleryImages, getPublishedServices } from "@/lib/data";
import { menuItemsFrom, readableRange } from "@/lib/price-menu";
import { INCLUDED_LINE, discountNote, groupServices, servicePrice } from "@/lib/services";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Services and Pricing",
  description:
    "Real estate photo packages priced by square footage, plus drone, video and floor plans, for listings and rentals in Chicagoland.",
  alternates: { canonical: "/services" }
};

// Batch 5 (design.md "Services and pricing"; DES-9, DES-21, DES-22): one page with real
// tables built from the published Service rows (QA-2), the repeat-listing line, a side
// panel, then the price menu with the live total (which carries the offer, once).
// /pricing 308-redirects here (next.config.mjs).
export default async function ServicesPage() {
  const [services, photos] = await Promise.all([getPublishedServices(), getFeaturedGalleryImages(2)]);
  const groups = groupServices(services);
  const [photoGroup, addOnGroup, videoGroup, discountGroup] = groups;
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

      <section className="wrap tables" aria-label="Price list">
        <div className="tables__main">
          {photoGroup.services.length ? (
            <table className="ptable">
              <caption className="h3">Photo packages</caption>
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Home size</th>
                  <th scope="col">Edited photos</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {photoGroup.services.map((service) => (
                  <tr key={service.id}>
                    <th scope="row">{service.title}</th>
                    <td>{service.squareFeet ?? "Any size"}</td>
                    <td>{readableRange(service.deliverable)}</td>
                    <td className="num">{servicePrice(service)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {addOnGroup.services.length || videoGroup.services.length ? (
            <div className="tables__pair">
              {[
                { group: addOnGroup, caption: "Add-ons", first: "Add to any package" },
                { group: videoGroup, caption: "Video", first: "Service" }
              ]
                .filter(({ group }) => group.services.length)
                .map(({ group, caption, first }) => (
                  <table className="ptable" key={group.key}>
                    <caption className="h3">{caption}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{first}</th>
                        <th scope="col" className="num">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.services.map((service) => (
                        <tr key={service.id}>
                          <th scope="row">
                            {service.title}
                            <span className="hint">
                              {readableRange(service.deliverable)}
                            </span>
                          </th>
                          <td className="num">{servicePrice(service)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
            </div>
          ) : null}
          {discountGroup.services.map((service) => (
            <p className="tables__note" key={service.id}>
              <b>{service.title}:</b> {readableRange(service.description)}
            </p>
          ))}
          <p className="tables__note">{INCLUDED_LINE}</p>
        </div>
        <aside className="tables__side" aria-label="Not sure which package fits?">
          {sidePhoto ? <Photo src={sidePhoto.imageUrl} alt={sidePhoto.alt} sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 30vw" /> : null}
          <p>Not sure which package fits? Send the address and the square footage, and Francisco will tell you.</p>
          <Link className="btn" href="/contact#form">
            Book a shoot
          </Link>
          <a className="link link--blue tap" href={`sms:${BUSINESS.phoneE164}`}>
            Text {BUSINESS.phoneDisplay}
          </a>
        </aside>
      </section>

      <PriceMenu menu={menuItemsFrom(services)} footnote={discountNote(services)} />
    </main>
  );
}
