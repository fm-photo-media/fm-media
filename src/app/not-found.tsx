import type { Metadata } from "next";
import Link from "next/link";
import { BrandPanel } from "@/components/photo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BUSINESS } from "@/lib/business";
import { hasPublicPortfolio } from "@/lib/data";
import { navLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true }
};

// Batch 5 (design.md "404"): the root not-found renders outside the (site) group, so it
// brings the public header and footer itself. The photo slot shows the no-photo panel.
export default async function NotFound() {
  // Batch 7: the same nav as the (site) layout, so Portfolio is listed only when it has photos.
  const hasPortfolio = await hasPublicPortfolio();
  const nav = navLinks(hasPortfolio);
  return (
    <>
      <SiteHeader nav={nav} />
      <main id="main">
        <section className="wrap nf" aria-labelledby="h1">
          <div>
            <h1 className="h1" id="h1">
              This page isn&apos;t here
            </h1>
            <p className="lede">The link may be old, or the address has a typo. Everything else is one tap away.</p>
            <ul className="nf__links fact">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/services">Services and pricing</Link>
              </li>
              {hasPortfolio ? (
                <li>
                  <Link href="/portfolio">Portfolio</Link>
                </li>
              ) : null}
              <li>
                <Link href="/contact">Book a shoot</Link>
              </li>
            </ul>
            <p className="nf__act">
              <Link className="btn" href="/">
                Go to the home page
              </Link>
            </p>
            <p className="fact nf__call">
              Or call or text{" "}
              <a className="link tap" href={`tel:${BUSINESS.phoneE164}`}>
                {BUSINESS.phoneDisplay}
              </a>
              .
            </p>
          </div>
          <BrandPanel />
        </section>
      </main>
      <SiteFooter nav={nav} />
    </>
  );
}
