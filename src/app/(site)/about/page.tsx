import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { BUSINESS } from "@/lib/business";
import { getPublishedGalleryImages, getPublishedServices } from "@/lib/data";
import { lowestPackage } from "@/lib/home";
import { groupByShoot } from "@/lib/portfolio";
import { PORTRAIT_URL } from "@/lib/site";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "About",
  description: "FM Media is a Chicagoland real estate photography business owned by Francisco Martinez.",
  alternates: { canonical: "/about" }
};

// Batch 5 (design.md "About"): plain copy with no claims, the facts, and two frames from one
// of his own shoots (only when he has uploaded them).
// Batch 8 (design.md "Build spec: Variant B", About): his name is the h1, set as a monument.
// The text takes columns 1-7 and the tint facts panel 9-12. The portrait (4:5) sits at the
// top of the panel only once PORTRAIT_URL is set (Legal R4 / DES-24).
export default async function AboutPage() {
  const [images, services] = await Promise.all([getPublishedGalleryImages(), getPublishedServices()]);
  const lowest = lowestPackage(services)?.startingAt ?? null;
  const firstSet = groupByShoot(images)[0];
  const frames = firstSet && firstSet.images.length >= 2 ? firstSet.images.slice(0, 2) : [];

  return (
    <main id="main">
      <section className="phead" aria-labelledby="h1">
        <div className="wrap">
          <h1 className="mon mon--page" id="h1">
            {BUSINESS.owner}
          </h1>
        </div>
      </section>

      <section className="wrap about" aria-label={`About ${BUSINESS.name}`}>
        <div className="about__text">
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
        </div>
        <aside className="about__side" aria-label={`Contact ${BUSINESS.name}`}>
          {PORTRAIT_URL ? (
            <figure className="ph portrait">
              <Image src={PORTRAIT_URL} alt={`Portrait of ${BUSINESS.owner}`} fill sizes="(max-width: 900px) 100vw, 30vw" />
            </figure>
          ) : null}
          <dl className="facts fact">
            <div>
              <dt>Serves</dt>
              <dd>{BUSINESS.serviceArea}</dd>
            </div>
            <div>
              <dt>Call or text</dt>
              <dd>
                <a href={`tel:${BUSINESS.phoneE164}`}>{BUSINESS.phoneDisplay}</a>
                <span className="touch-only">
                  &nbsp;·&nbsp;<a href={`sms:${BUSINESS.phoneE164}`}>Send a text</a>
                </span>
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
            <Link className="link link--blue tap fact" href="/services">
              See the prices
            </Link>
          </div>
        </aside>
      </section>

      {frames.length ? (
        <section className="wrap strip" aria-labelledby="strip-h">
          <h2 className="h2" id="strip-h">
            From one shoot
          </h2>
          <div className="strip__grid">
            {frames.map((image) => (
              <Photo key={image.id} src={image.imageUrl} alt={image.alt} sizes="(max-width: 640px) 100vw, 50vw" />
            ))}
          </div>
          <Link className="link link--blue tap fact" href="/portfolio">
            See the whole shoot
          </Link>
        </section>
      ) : null}
    </main>
  );
}
