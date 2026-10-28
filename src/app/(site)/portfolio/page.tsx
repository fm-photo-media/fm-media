import type { Metadata } from "next";
import Link from "next/link";
import { PortfolioGallery, type GallerySet } from "@/components/portfolio-gallery";
import { BUSINESS } from "@/lib/business";
import { getPublishedGalleryImages } from "@/lib/data";
import { groupByShoot, shootCaption } from "@/lib/portfolio";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Real estate photography portfolio: homes, apartments and short-term rentals in Chicagoland, shown one shoot at a time.",
  alternates: { canonical: "/portfolio" }
};

const photoCount = (count: number) => `${count} ${count === 1 ? "photo" : "photos"}`;

// Batch 5 (design.md "Portfolio"; research pattern 7): one set per shoot, captioned by town,
// never by street address. Only Francisco's own uploads show (gallery-visibility.ts); images
// without a shoot form one ungrouped set. An empty state in tint keeps the frame.
export default async function PortfolioPage() {
  const images = await getPublishedGalleryImages();
  const groups = groupByShoot(images);

  const sets: GallerySet[] = groups.map((group, index) => {
    const caption = shootCaption(group.shoot, group.town);
    const heading = caption ?? (groups.length > 1 ? "More photos" : "Recent photos");
    return {
      key: group.shoot ? `s${index}` : "more",
      heading,
      meta: photoCount(group.images.length),
      tiles: group.images.map((image) => ({
        id: image.id,
        src: image.imageUrl,
        alt: image.alt,
        title: image.title,
        caption: caption ? `${caption}: ${image.title}` : image.title
      }))
    };
  });

  return (
    <main id="main">
      <section className="phead" aria-labelledby="h1">
        <div className="wrap">
          <h1 className="h1" id="h1">
            Portfolio
          </h1>
          <p className="lede">Whole shoots, one home at a time, so you can see what a listing gets.</p>
          <p className="phead__act">
            <Link className="btn" href="/contact#form">
              Book a shoot
            </Link>
          </p>
        </div>
      </section>

      {sets.length ? <PortfolioGallery sets={sets} /> : null}

      <section className="wrap shoot shoot--next" aria-labelledby="more-h">
        <h2 className="h2" id="more-h">
          {sets.length ? "More shoots" : "Portfolio update"}
        </h2>
        {sets.length ? (
          <p>Each new shoot is added here as its own set, with its town.</p>
        ) : (
          // Legal batch 4: the neutral empty-portfolio line, with tel and sms links.
          // DES-29: the sms: link only on touch screens; a single tel: link on desktop.
          <p className="fact">
            Our portfolio is being updated. Questions in the meantime?{" "}
            <span className="touch-only">
              Call or&nbsp;
              <a className="link tap" href={`sms:${BUSINESS.phoneE164}`}>
                text
              </a>
              &nbsp;
              <a className="link tap" href={`tel:${BUSINESS.phoneE164}`}>
                {BUSINESS.phoneDisplay}
              </a>
              .
            </span>
            <span className="fine-only">
              <a className="link tap" href={`tel:${BUSINESS.phoneE164}`}>
                Call or text {BUSINESS.phoneDisplay}
              </a>
              .
            </span>
          </p>
        )}
      </section>
    </main>
  );
}
