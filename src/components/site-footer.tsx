import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import type { NavLink } from "@/lib/site";

// LEG-2 (batch4-copy section 3): name, owner, call/text, email and the Chicagoland service
// area. LEG-1: Privacy Policy and Terms of Service on every page. QA-11: every footer link
// is at least 44px tall.
// Batch 8 (design.md "Build spec: Variant B", Footer): the blue field with the white logo
// mark beside FM MEDIA (the mark is alt="", so the name is read once), "Real Estate Media",
// the ways in the serif, then the nav plus the legal links in 3 rows that flow by column.
// The footer meets a page that ends on a full-bleed field with no gap (globals.css).
export function SiteFooter({ nav }: { nav: readonly NavLink[] }) {
  return (
    <footer className="foot on-blue">
      <h2 className="vh">Contact {BUSINESS.name}</h2>
      <div className="wrap">
        <p className="foot__brand">
          <Image src="/brand/logo-mark-white.png" width={564} height={377} sizes="(max-width: 640px) 17vw, 258px" alt="" />
          <span className="foot__name">{BUSINESS.name}</span>
        </p>
        <p className="foot__tag">Real Estate Media</p>
        <div className="foot__row">
          <div className="foot__ways">
            <a href={`tel:${BUSINESS.phoneE164}`}>{BUSINESS.phoneDisplay}</a>
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
            <span>Serving {BUSINESS.serviceArea}</span>
            <p className="small">
              Owner: {BUSINESS.owner} · <a href="https://fm-media.org">fm-media.org</a>
            </p>
            <p className="small touch-only">
              <a href={`sms:${BUSINESS.phoneE164}`}>Send a text</a>
            </p>
          </div>
          <nav className="foot__nav" aria-label="Footer">
            <ul className="foot__links">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms">Terms of Service</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="foot__legal">
          <span>© 2026 {BUSINESS.name}</span>
          <a href="#top">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
