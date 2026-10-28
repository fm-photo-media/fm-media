"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// Batch 5b (design.md note 1): at 900px and below the sidebar opens as a full-screen sheet
// from the top bar's Menu button. Same behaviour as the public menu sheet: aria-expanded,
// Esc and Close shut it, a navigation shuts it, Tab stays inside, focus returns to Menu.
// Without script the sidebar is simply always in the markup (and shows at desktop widths).

export function AdminFrame({ side, top, children }: { side: ReactNode; top: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sideRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      document.body.style.overflow = "hidden";
      sideRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    } else {
      document.body.style.overflow = "";
      if (wasOpen.current) menuRef.current?.focus();
      wasOpen.current = false;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function onSideKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !sideRef.current) return;
    const focusable = sideRef.current.querySelectorAll<HTMLElement>("a[href], button");
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

  return (
    <div className="ad-app">
      <a className="ad-skip" href="#main">
        Skip to content
      </a>
      <aside
        id="admin-side"
        ref={sideRef}
        className={`ad-side${open ? " is-open" : ""}`}
        aria-label="Admin"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        onKeyDown={onSideKeyDown}
      >
        {side}
        <button className="ad-btn ad-side__close" type="button" onClick={close}>
          Close menu
        </button>
      </aside>
      <header className="ad-top">
        {top}
        <button
          ref={menuRef}
          className="ad-btn ad-menu-btn"
          type="button"
          aria-expanded={open}
          aria-controls="admin-side"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
      </header>
      <main id="main" className="ad-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
