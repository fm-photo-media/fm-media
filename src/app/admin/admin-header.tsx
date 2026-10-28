import Image from "next/image";
import Link from "next/link";
import { logoutAdmin } from "@/app/actions";

type Section = "requests" | "gallery" | "services";

const LINKS: { key: Section; href: string; label: string }[] = [
  { key: "requests", href: "/admin", label: "Requests" },
  { key: "gallery", href: "/admin/gallery", label: "Gallery" },
  { key: "services", href: "/admin/services", label: "Services and prices" }
];

// Batch 5 (design.md "Logo files", admin shell): the logo mark at 40px with "FM Media admin",
// linking to /admin, then the admin sections, the public site and Sign out. Every target
// is at least 44px tall (QA-23). The full admin restyle is batch 5b.
export function AdminHeader({ current }: { current: Section }) {
  return (
    <header className="admin-top">
      <div className="admin-top__in">
        <Link className="admin-brand" href="/admin">
          <Image src="/brand/logo-mark.png" width={564} height={377} alt="" sizes="60px" priority />
          <b>FM Media</b>
          <span>admin</span>
        </Link>
        <nav aria-label="Admin" className="admin-nav">
          {LINKS.map((link) => (
            <Link key={link.key} href={link.href} aria-current={link.key === current ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
          <Link href="/">View the site</Link>
          <form action={logoutAdmin}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
