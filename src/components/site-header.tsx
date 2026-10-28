"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BUSINESS } from "@/lib/business";
import type { NavLink } from "@/lib/site";

// Batch 5 (design.md "Header", "Menu sheet"; DES-14, QA-11g): the logo on every public page,
// the nav with one "Book a shoot", the phone as a tel: link, and below 1000px a "Menu"
// button that opens a full-screen sheet. The sheet sets aria-expanded, closes on Esc, on a
// link tap, on Close and on route change, keeps Tab inside it, and returns focus to Menu.

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Batch 7: `nav` comes from the (site) layout, without Portfolio while it has no photos.
export function SiteHeader({ nav }: { nav: readonly NavLink[] }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // A navigation closes the sheet (the sheet's links also close it on tap).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      document.body.style.overflow = "hidden";
      closeRef.current?.focus();
    } else {
      document.body.style.overflow = "";
      if (wasOpen.current) buttonRef.current?.focus();
      wasOpen.current = false;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function onSheetKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelectorAll<HTMLElement>("a[href], button");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const current = (href: string) => (isCurrent(pathname, href) ? ("page" as const) : undefined);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <div className="wrap">
          <Link className="top__logo" href="/" aria-current={current("/")}>
            <Image src="/brand/logo-full.png" width={564} height={519} alt="FM Media" priority sizes="(max-width: 640px) 74px, 113px" />
          </Link>
          <nav aria-label="Main">
            <ul className="top__nav">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={current(item.href)}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="keep">
                <a className="call" href={`tel:${BUSINESS.phoneE164}`}>
                  {BUSINESS.phoneDisplay}
                </a>
              </li>
              <li className="keep">
                <button
                  ref={buttonRef}
                  className="menu-btn"
                  type="button"
                  aria-expanded={open}
                  aria-controls="menu"
                  onClick={() => setOpen(true)}
                >
                  Menu
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <div
        ref={sheetRef}
        className="sheet"
        id="menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        onKeyDown={onSheetKeyDown}
      >
        <div className="sheet__head">
          <Image src="/brand/logo-full.png" width={564} height={519} alt="FM Media" sizes="74px" />
          <button ref={closeRef} className="menu-btn" type="button" onClick={close}>
            Close
          </button>
        </div>
        <nav aria-label="Menu">
          <Link href="/" aria-current={current("/")} onClick={close}>
            Home
          </Link>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={current(item.href)} onClick={close}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sheet__acts">
          <a className="btn" href={`sms:${BUSINESS.phoneE164}`}>
            Text {BUSINESS.phoneDisplay}
          </a>
          <a className="btn btn--quiet" href={`tel:${BUSINESS.phoneE164}`}>
            Call
          </a>
        </div>
      </div>
    </>
  );
}
