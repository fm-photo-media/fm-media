import Link from "next/link";

const nav = [
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-[#fbfaf8]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="focus-ring font-serif text-xl tracking-normal">
            FM Media
          </Link>
        </div>
        <nav aria-label="Primary navigation" className="hidden items-center gap-x-6 text-sm font-medium md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="focus-ring text-ink/70 transition hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/contact"
          className="focus-ring hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-clay md:inline-flex"
        >
          Book a Shoot
        </Link>
        <details className="relative md:hidden">
          <summary className="focus-ring list-none rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
            Menu
          </summary>
          <nav
            aria-label="Mobile navigation"
            className="absolute right-0 top-12 z-40 grid min-w-44 gap-1 rounded-lg border border-line bg-white p-2 text-sm font-medium shadow-soft"
          >
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="focus-ring rounded-md px-3 py-2 text-ink/75 hover:bg-mist hover:text-ink">
                {item.label}
              </Link>
            ))}
            <Link href="/contact" className="focus-ring rounded-md bg-ink px-3 py-2 text-white hover:bg-clay">
              Book a Shoot
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
