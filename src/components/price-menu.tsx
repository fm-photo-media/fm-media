"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BUSINESS } from "@/lib/business";
import { priceHeadline } from "@/lib/home";
import { bookingHref, DRONE_PHOTOS_SLUG, firstShootOfferAvailable, menuTotal, type Menu, type MenuItem } from "@/lib/price-menu";
import { firstShootDroneOffer } from "@/lib/promotion";

// Batch 5 (design.md "Price menu + live total"): every row is a published Service from the
// DB. Tick a package and extras and the total adds itself up; the first-shoot box makes
// drone photos $0 with a package (Legal's terms, shown in full once). "Text it" (sms:) shows
// on touch screens only, and "Book this shoot" carries the choices into the booking form.
// Without script it is a plain price list.
// Batch 8 (design.md "Build spec: Variant B", Price sentence / Price list): the heading is
// the price sentence ("Listing photos from $X", the figure on a blue .tag), at the level the
// page asks for (h2 on home, h1 on /services). Packages run 4-up; Add-ons and the offer share
// one column and Video takes the other. The list, footnotes and total sit in one .plist-wrap,
// so the phone's sticky total shows only while the list is on screen and never covers the
// sentence.

function Package({ item, checked, onChange }: { item: MenuItem; checked: boolean; onChange: () => void }) {
  return (
    <label className="pkg">
      <input type="radio" name="package" value={item.slug} checked={checked} onChange={onChange} />
      <b>{item.title}</b>
      <span className="amt">{item.price}</span>
      {item.note ? <span className="note">{item.note}</span> : null}
    </label>
  );
}

function Extra({ item, checked, onChange }: { item: MenuItem; checked: boolean; onChange: () => void }) {
  return (
    <label className="item">
      <input type="checkbox" name="add" value={item.slug} checked={checked} onChange={onChange} />
      <b>{item.title}</b>
      <span className="price">{item.price}</span>
      {item.note ? <span className="note">{item.note}</span> : null}
    </label>
  );
}

export function PriceMenu({
  menu,
  heading,
  headingId,
  under,
  footnote,
  idPrefix = "prices",
  className
}: {
  menu: Menu;
  /** The price sentence's level: "h2" on home, "h1" on /services (the page's only h1). */
  heading: "h1" | "h2";
  /** Defaults to `${idPrefix}-h`; /services passes "h1". */
  headingId?: string;
  /** The row under the sentence (columns 1-7 text, 9-12 action or help). */
  under?: ReactNode;
  /** Batch 7: one paragraph per line (Services adds the "every photo package includes" line). */
  footnote?: string | readonly string[];
  idPrefix?: string;
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
  const titleId = headingId ?? `${idPrefix}-h`;
  const footnotes = typeof footnote === "string" ? [footnote] : (footnote ?? []);
  const { lowest } = priceHeadline(menu.packages);
  const Heading = heading;
  // QA-38: the group headings sit one level under the sentence (h2 on /services, h3 on home).
  const Group = heading === "h1" ? "h2" : "h3";
  // LEG-14: the offer only where it can be honoured (drone photos and a package offered).
  const showOffer = firstShootOfferAvailable(menu.packages.length, menu.addOns.map((item) => item.slug));

  const offerHint =
    firstShoot && total.pkg && hasDrone && !extras.includes(DRONE_PHOTOS_SLUG) ? "Add drone photos: free on your first shoot" : "";

  const offer = (
    <div className="offer">
      <p>
        <b>{firstShootDroneOffer.body}</b>
      </p>
      <p className="terms">{firstShootDroneOffer.terms}</p>
      <label className="check">
        <input type="checkbox" name="first" checked={firstShoot} onChange={(event) => setFirstShoot(event.target.checked)} />
        This is my first shoot with FM Media
      </label>
    </div>
  );

  return (
    <section className={`prices${className ? ` ${className}` : ""}`} id={idPrefix} aria-labelledby={titleId}>
      <div className="wrap">
        <Heading className="display" id={titleId}>
          {lowest ? (
            <>
              Listing photos
              <br />
              from <span className="tag">${lowest}</span>
            </>
          ) : (
            "Services and pricing"
          )}
        </Heading>
        {under ? <div className="prices__under">{under}</div> : null}
        <div className="plist-wrap">
          <form
            className="plist"
            id="builder"
            onSubmit={(event) => event.preventDefault()}
            aria-label="Price list: tick what the listing needs and the total adds itself up"
          >
            {menu.packages.length ? (
              <div className="group" role="group" aria-labelledby={`${idPrefix}-pkg`}>
                <Group className="h3 group__h" id={`${idPrefix}-pkg`}>
                  Photo packages
                </Group>
                <div className="pkgs">
                  {menu.packages.map((item) => (
                    <Package key={item.slug} item={item} checked={packageSlug === item.slug} onChange={() => setPackageSlug(item.slug)} />
                  ))}
                </div>
              </div>
            ) : null}
            <div className="extras">
              <div>
                {menu.addOns.length ? (
                  <div className="group" role="group" aria-labelledby={`${idPrefix}-add`}>
                    <Group className="h3 group__h" id={`${idPrefix}-add`}>
                      Add-ons
                    </Group>
                    {menu.addOns.map((item) => (
                      <Extra key={item.slug} item={item} checked={extras.includes(item.slug)} onChange={() => toggle(item.slug)} />
                    ))}
                  </div>
                ) : null}
                {showOffer ? offer : null}
              </div>
              {menu.video.length ? (
                <div className="group" role="group" aria-labelledby={`${idPrefix}-video`}>
                  <Group className="h3 group__h" id={`${idPrefix}-video`}>
                    Video
                  </Group>
                  {menu.video.map((item) => (
                    <Extra key={item.slug} item={item} checked={extras.includes(item.slug)} onChange={() => toggle(item.slug)} />
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
        </div>
      </div>
    </section>
  );
}
