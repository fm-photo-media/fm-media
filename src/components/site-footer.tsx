import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-ink/70 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="font-serif text-xl text-ink">FM Media</p>
          <p className="mt-2 max-w-md">
            Real estate photography for listings, rentals, hospitality, and commercial spaces.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 md:justify-end">
          <Link href="/portfolio" className="focus-ring hover:text-ink">
            Portfolio
          </Link>
          <Link href="/services" className="focus-ring hover:text-ink">
            Services
          </Link>
          <Link href="/contact" className="focus-ring hover:text-ink">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
