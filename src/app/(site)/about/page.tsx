import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { BUSINESS } from "@/lib/business";
import { getPublishedGalleryImages, getPublishedServices } from "@/lib/data";
import { groupByShoot } from "@/lib/portfolio";
import { PORTRAIT_URL } from "@/lib/site";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "About",
  description: "FM Media is a Chicagoland real estate photography business owned by Francisco Martinez.",
  alternates: { canonical: "/about" }
};

// Batch 5 (design.md "About"): the photographer's name as the title, a portrait slot that
// stays a tint box until Francisco sends his portrait, plain copy with no claims, the
// facts, and two frames from one of his own shoots (only when he has uploaded them).
export default async function AboutPage() {
  const [images, services] = await Promise.all([getPublishedGalleryImages(), getPublishedServices()]);
  const packagePrices = services.filter((service) => service.category === "PHOTO" && service.startingAt > 0).map((service) => service.startingAt);
  const lowest = packagePrices.length ? Math.min(...packagePrices) : null;
  const firstSet = groupByShoot(images)[0];
  const frames = firstSet && firstSet.images.length >= 2 ? firstSet.images.slice(0, 2) : [];

  const facts = (
    <>
      <dl className="facts fact">
        <div>
          <dt>Serves</dt>
          <dd>
            <span>{BUSINESS.serviceArea}</span>
          </dd>
        </div>
        <div>
          <dt>Call or text</dt>
          <dd>
            <a href={`tel:${BUSINESS.phoneE164}`}>{BUSINESS.phoneDisplay}</a>
            {" · "}
            <a href={`sms:${BUSINESS.phoneE164}`}>Send a text</a>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </dd>
        </div>
      </dl>
      <div className="about__act">
        <Link className="btn" href="/contact#form">
          Book a shoot
        </Link>
        <Link className="link fact" href="/services">
          See the prices
        </Link>
      </div>
    </>
  );

  return (
    <main id="main">
      <section className="wrap about" aria-labelledby="h1">
        {/* Legal R4 / DES-24 (round 1): the portrait slot appears only once a portrait exists. */}
        {PORTRAIT_URL ? (
          <figure className="portrait">
            <Image src={PORTRAIT_URL} alt={`Portrait of ${BUSINESS.owner}`} fill sizes="(max-width: 900px) 100vw, 40vw" />
          </figure>
        ) : null}
        <div className={PORTRAIT_URL ? "about__text" : "about__text about__text--solo"}>
          <h1 className="h1" id="h1">
            {BUSINESS.owner}
          </h1>
          {/* Legal R3 (round 1): no "one photographer" or "himself" until Francisco confirms it. */}
          <p className="lede">
            {BUSINESS.name} is {BUSINESS.owner}&apos;s real estate photography business, offering listing photos, drone, video and floor
            plans for agents across {BUSINESS.serviceArea}.
          </p>
          <p>
            When you book, you deal with Francisco directly. He confirms the time and the price with you before the shoot, and the photos are
            edited for the MLS.
          </p>
          <p>
            Prices are public{lowest ? ` and start at $${lowest}` : ""}, sized to the home&apos;s square footage, so you know the cost before you
            call.
          </p>
          {PORTRAIT_URL ? facts : null}
        </div>
        {/* With no portrait, the facts sit on the right in a tint panel, so the page keeps both margins. */}
        {PORTRAIT_URL ? null : (
          <aside className="about__side" aria-label={`Contact ${BUSINESS.name}`}>
            {facts}
          </aside>
        )}
      </section>

      {frames.length ? (
        <section className="wrap section strip" aria-labelledby="strip-h">
          <h2 className="h2" id="strip-h">
            From one shoot
          </h2>
          <div className="strip__grid">
            {frames.map((image) => (
              <Photo key={image.id} src={image.imageUrl} alt={image.alt} sizes="(max-width: 640px) 100vw, 50vw" />
            ))}
          </div>
          <Link className="link fact" href="/portfolio">
            See the whole shoot
          </Link>
        </section>
      ) : null}
    </main>
  );
}
