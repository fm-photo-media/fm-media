"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BUSINESS } from "@/lib/business";
import { bookingHref, DRONE_PHOTOS_SLUG, menuTotal, type Menu, type MenuItem } from "@/lib/price-menu";
import { firstShootDroneOffer } from "@/lib/promotion";

// Batch 5 (design.md "Price menu + live total"; critique changes 1 and 2): every row is a
// published Service from the DB. Tick a package and extras and the total adds itself up;
// the first-shoot box makes drone photos $0 with a package (Legal's terms, shown in full
// under the add-ons, once). "Text it" (sms:) shows on touch screens only, and "Book this
// shoot" carries the choices into the booking form. Without script it is a plain price list.

function Item({ item, type, name, checked, onChange }: { item: MenuItem; type: "radio" | "checkbox"; name: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="item">
      <input type={type} name={name} value={item.slug} checked={checked} onChange={onChange} />
      <span className="item__row">
        <b>{item.title}</b>
        <span className="fact">{item.price}</span>
      </span>
      {item.note ? <span className="item__note">{item.note}</span> : null}
    </label>
  );
}

export function PriceMenu({
  menu,
  footnote,
  idPrefix = "prices",
  aside,
  className
}: {
  menu: Menu;
  /** Batch 7: one paragraph per line (Services adds the "every photo package includes" line). */
  footnote?: string | readonly string[];
  idPrefix?: string;
  aside?: ReactNode;
  className?: string;
}) {
  const [packageSlug, setPackageSlug] = useState(menu.packages[0]?.slug ?? "");
  const [extras, setExtras] = useState<string[]>([]);
  const [firstShoot, setFirstShoot] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const choice = { packageSlug, extras, firstShoot };
  const total = menuTotal(menu, choice);
  const hasDrone = menu.addOns.some((item) => item.slug === DRONE_PHOTOS_SLUG);
  const parts = [
    ...(total.pkg ? [`${total.pkg.title} photos`] : []),
    ...total.extras.map((item) => (total.droneFree && item.slug === DRONE_PHOTOS_SLUG ? `${item.title} (first-shoot offer)` : item.title))
  ];
  // Legal (round 1): a request against the price list, not a booked price (Terms §1 and §2).
  const smsBody = `Hi Francisco, I'd like to request a shoot: ${parts.join(" + ") || "a shoot"}, ${total.label} on your price list. Address: `;
  const toggle = (slug: string) => setExtras((list) => (list.includes(slug) ? list.filter((value) => value !== slug) : [...list, slug]));
  const headingId = `${idPrefix}-h`;
  const footnotes = typeof footnote === "string" ? [footnote] : (footnote ?? []);

  const offerHint =
    firstShoot && total.pkg && hasDrone && !extras.includes(DRONE_PHOTOS_SLUG) ? "Add drone photos: free on your first shoot" : "";

  return (
    <section className={`wrap prices section${className ? ` ${className}` : ""}`} id={idPrefix} aria-labelledby={headingId}>
      <div className="prices__head">
        <div>
          <h2 className="h2" id={headingId}>
            What a shoot costs
          </h2>
          <p>Tick what the listing needs. The total adds itself up, and you can send it straight to Francisco.</p>
        </div>
        {aside}
      </div>
      <form className="prices__list" onSubmit={(event) => event.preventDefault()} aria-labelledby={headingId}>
        <div>
          {menu.packages.length ? (
            <div className="group" role="group" aria-labelledby={`${idPrefix}-pkg`}>
              <h3 className="h3 group__h" id={`${idPrefix}-pkg`}>
                Photo packages
              </h3>
              {menu.packages.map((item) => (
                <Item key={item.slug} item={item} type="radio" name="package" checked={packageSlug === item.slug} onChange={() => setPackageSlug(item.slug)} />
              ))}
            </div>
          ) : null}
        </div>
        {/* DES-27: add-ons and the offer sit next to the packages they apply to; video follows. */}
        <div>
          {menu.addOns.length ? (
            <div className="group" role="group" aria-labelledby={`${idPrefix}-add`}>
              <h3 className="h3 group__h" id={`${idPrefix}-add`}>
                Add-ons
              </h3>
              {menu.addOns.map((item) => (
                <Item key={item.slug} item={item} type="checkbox" name="add" checked={extras.includes(item.slug)} onChange={() => toggle(item.slug)} />
              ))}
            </div>
          ) : null}
          <div className="offer">
            <p>
              <b>{firstShootDroneOffer.body}</b>
            </p>
            <p className="terms">{firstShootDroneOffer.terms}</p>
            <label className="check">
              <input type="checkbox" name="first" checked={firstShoot} onChange={(event) => setFirstShoot(event.target.checked)} />
              <b>This is my first shoot with FM Media</b>
            </label>
          </div>
          {menu.video.length ? (
            <div className="group" role="group" aria-labelledby={`${idPrefix}-video`}>
              <h3 className="h3 group__h" id={`${idPrefix}-video`}>
                Video
              </h3>
              {menu.video.map((item) => (
                <Item key={item.slug} item={item} type="checkbox" name="add" checked={extras.includes(item.slug)} onChange={() => toggle(item.slug)} />
              ))}
            </div>
          ) : null}
        </div>
      </form>
      {footnotes.length ? (
        <div className="prices__foot">
          {footnotes.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {ready ? (
        <div className="total" aria-live="polite">
          <div className="total__sum">
            <span>Your shoot comes to</span>
            <output>{total.label}</output>
          </div>
          <p className="total__note">
            {total.droneFree ? (
              <>
                <span className="long">Drone photos free on your first shoot </span>
                <span className="short">Drone free </span>({"−"}${total.freeAmount})
              </>
            ) : (
              offerHint
            )}
          </p>
          <div className="total__acts">
            <a className="btn btn--paper touch-only" href={`sms:${BUSINESS.phoneE164}?&body=${encodeURIComponent(smsBody)}`}>
              Text it
            </a>
            <Link className="btn btn--paper" href={bookingHref(choice)}>
              Book this shoot
            </Link>
            <span className="fine-only or">
              or call or text{" "}
              <a className="fact" href={`tel:${BUSINESS.phoneE164}`}>
                {BUSINESS.phoneDisplay}
              </a>
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
