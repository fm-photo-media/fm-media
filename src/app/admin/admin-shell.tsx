import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdmin, logoutAllAdminSessions } from "@/app/actions";
import { AdminFrame } from "@/app/admin/admin-frame";
import { prisma } from "@/lib/prisma";

// Batch 5b (design.md "Admin build spec", note 1 and 2): the 224px sidebar with the logo mark
// and "FM Media admin", the three sections (Requests with its "N new" count), and at the
// foot View the site and the ONE Sign out, with "Sign out on all devices" in a small Session
// line under it. The 64px top bar holds the breadcrumb and fm-media.org. The logo and the
// content start on the same left edge (the sidebar's 20px inset; the canvas's 32px gutter).

type Section = "requests" | "gallery" | "services";

const LINKS: { key: Section; href: string; label: string }[] = [
  { key: "requests", href: "/admin", label: "Requests" },
  { key: "gallery", href: "/admin/gallery", label: "Gallery" },
  { key: "services", href: "/admin/services", label: "Services and prices" }
];

async function newRequestCount() {
  try {
    return await prisma.inquiry.count({ where: { status: "NEW" } });
  } catch (error) {
    console.error("[admin] could not count new requests", error);
    return null;
  }
}

export async function AdminShell({ current, crumb, children }: { current: Section; crumb: ReactNode; children: ReactNode }) {
  const newCount = await newRequestCount();

  const side = (
    <>
      <Link className="ad-brand" href="/admin">
        <Image src="/brand/logo-mark.png" width={564} height={377} alt="" sizes="42px" priority />
        <b>FM Media</b>
        <span>admin</span>
      </Link>
      <nav className="ad-nav" aria-label="Admin sections">
        {LINKS.map((link) => (
          <Link key={link.key} href={link.href} aria-current={link.key === current ? "page" : undefined}>
            <span>{link.label}</span>
            {link.key === "requests" && newCount ? <span className="ad-count">{newCount} new</span> : null}
          </Link>
        ))}
      </nav>
      <div className="ad-side__foot ad-nav">
        <Link href="/">View the site</Link>
        <form action={logoutAdmin}>
          <button type="submit">Sign out</button>
        </form>
        <form action={logoutAllAdminSessions} className="ad-session">
          <span>Lost a phone or used a shared computer? </span>
          <button type="submit">Sign out on all devices</button>
        </form>
      </div>
    </>
  );

  const top = (
    <>
      <div className="ad-top__lead">
        <Link className="ad-top__mark" href="/admin" aria-label="FM Media admin home">
          <Image src="/brand/logo-mark.png" width={564} height={377} alt="" sizes="36px" />
        </Link>
        <p className="ad-crumb">{crumb}</p>
      </div>
      <div className="ad-top__right">
        <Link className="ad-hide-sm" href="/">
          fm-media.org
        </Link>
      </div>
    </>
  );

  return (
    <AdminFrame side={side} top={top}>
      {children}
    </AdminFrame>
  );
}
