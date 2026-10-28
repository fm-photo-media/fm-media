import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import type { NavLink } from "@/lib/site";

// Batch 5 (design.md "Footer card"): Francisco's business card as the page's close: blue
// bands, the logo, "Real Estate Media", the contact lines, a send line with "Book a shoot",
// then the link rows. LEG-2 (batch4-copy section 3): name, owner, call/text, email and the
// Chicagoland service area. LEG-1: Privacy Policy and Terms of Service on every page.
// QA-11: every footer link is at least 44px tall.
export function SiteFooter({ nav }: { nav: readonly NavLink[] }) {
  return (
    <footer className="foot on-blue">
      <h2 className="vh">Contact {BUSINESS.name}</h2>
      <div className="bizcard">
        <div className="bizcard__brand">
          <Image
            src="/brand/logo-full.png"
            width={564}
            height={519}
            sizes="160px"
            alt="FM Media logo: a house drawn from the letters F and M, with a drone on the roof and a camera aperture in the window"
          />
          <p className="bizcard__tag">Real Estate Media</p>
        </div>
        <div className="bizcard__lines">
          <a href={`tel:${BUSINESS.phoneE164}`}>{BUSINESS.phoneDisplay}</a>
          <a href={`sms:${BUSINESS.phoneE164}`}>Send a text</a>
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          <a href="https://fm-media.org">fm-media.org</a>
          <span>Serving {BUSINESS.serviceArea}</span>
          <span className="bizcard__owner">Owner: {BUSINESS.owner}</span>
        </div>
        <div className="bizcard__send">
          <p>Send the address, the square footage and a day that works.</p>
          <Link className="btn" href="/contact#form">
            Book a shoot
          </Link>
        </div>
      </div>
      <div className="foot__links">
        <nav aria-label="Footer">
          <ul>
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <ul>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/terms">Terms of Service</Link>
          </li>
          <li>
            <span>© 2026 {BUSINESS.name}</span>
          </li>
        </ul>
      </div>
    </footer>
  );
}
