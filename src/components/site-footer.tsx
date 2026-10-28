import Link from "next/link";
import { BUSINESS } from "@/lib/business";

// LEG-2 (batch4-copy section 3): the business identity replaces the old tagline.
// LEG-1 (section 2): Privacy Policy and Terms of Service links on every page.
export function SiteFooter() {
  return (
    <footer className="bg-mist">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-ink/70 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="font-serif text-xl text-ink">{BUSINESS.name}</p>
          <p className="mt-2 max-w-md">{BUSINESS.tagline}</p>
          <p className="mt-1">Owner: {BUSINESS.owner}</p>
          <p className="mt-1">
            Call or text{" "}
            <a href={`tel:${BUSINESS.phoneE164}`} className="focus-ring font-semibold text-ink underline">
              {BUSINESS.phoneDisplay}
            </a>
            {" · "}
            <a href={`sms:${BUSINESS.phoneE164}`} className="focus-ring font-semibold text-ink underline">
              Send a text
            </a>
          </p>
          <p className="mt-1">
            <a href={`mailto:${BUSINESS.email}`} className="focus-ring font-semibold text-ink underline">
              {BUSINESS.email}
            </a>
          </p>
          <p className="mt-3">© 2026 {BUSINESS.name}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap content-start gap-5 md:justify-end">
          <Link href="/portfolio" className="focus-ring hover:text-ink">
            Portfolio
          </Link>
          <Link href="/services" className="focus-ring hover:text-ink">
            Services
          </Link>
          <Link href="/contact" className="focus-ring hover:text-ink">
            Contact
          </Link>
          <Link href="/privacy" className="focus-ring hover:text-ink">
            Privacy Policy
          </Link>
          <Link href="/terms" className="focus-ring hover:text-ink">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
