"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

// Batch 5 (design.md "Shoot set", "Viewer"; DES-8): one section per shoot, captioned
// "[Shoot], [Town]" (never a street address), the lead image across the full width and the
// rest two per row, all 3:2. Every tile is a real link to the full image; with script it
// opens a <dialog> viewer with Previous/Next, arrow keys and Esc, and focus goes back to
// the tile it came from.

export type GalleryTile = { id: string; src: string; alt: string; title: string; caption: string };
export type GallerySet = { key: string; heading: string; meta: string; tiles: GalleryTile[] };

export function PortfolioGallery({ sets }: { sets: GallerySet[] }) {
  const tiles = sets.flatMap((set) => set.tiles);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLAnchorElement | null>(null);
  const [at, setAt] = useState(0);

  const show = useCallback((index: number) => setAt((index + tiles.length) % tiles.length), [tiles.length]);

  function open(event: MouseEvent<HTMLAnchorElement>, index: number) {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== "function") return; // plain link fallback
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openerRef.current = event.currentTarget;
    show(index);
    dialog.showModal();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => openerRef.current?.focus();
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const current = tiles[at];
  // Where each set starts in the flat list, so tiles count 1 to N across the page.
  const starts = sets.map((_, i) => sets.slice(0, i).reduce((sum, set) => sum + set.tiles.length, 0));

  return (
    <>
      {sets.map((set, setIndex) => (
        <section className="wrap shoot" key={set.key} aria-labelledby={`set-${set.key}`}>
          <div className="shoot__head">
            <h2 className="h2" id={`set-${set.key}`}>
              {set.heading}
            </h2>
            <p className="fact">{set.meta}</p>
          </div>
          <div className="shoot__grid">
            {set.tiles.map((tile, position) => {
              const tileIndex = starts[setIndex] + position;
              // The lead runs full width; an odd last tile does too, so no half row is left empty.
              const lead = position === 0 || (position === set.tiles.length - 1 && (set.tiles.length - 1) % 2 === 1);
              return (
                <a
                  key={tile.id}
                  className={`tile${lead ? " tile--lead" : ""}`}
                  href={tile.src}
                  onClick={(event) => open(event, tileIndex)}
                  aria-label={`Open full size: ${tile.caption}`}
                >
                  <figure className="ph ph--32">
                    <Image
                      src={tile.src}
                      alt={tile.alt}
                      fill
                      priority={tileIndex === 0}
                      sizes={lead ? "(max-width: 1440px) 100vw, 1376px" : "(max-width: 640px) 100vw, 50vw"}
                    />
                  </figure>
                </a>
              );
            })}
          </div>
        </section>
      ))}
      <dialog
        ref={dialogRef}
        className="viewer"
        aria-label="Photo viewer"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") show(at - 1);
          if (event.key === "ArrowRight") show(at + 1);
        }}
      >
        <div className="viewer__bar fact">
          <span aria-live="polite">
            {tiles.length ? `${at + 1} of ${tiles.length}` : ""}
          </span>
          <button type="button" className="btn btn--paper" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
        {current ? (
          // A plain <img>: the full-size file the tile links to, letterboxed in the viewer.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="viewer__img" src={current.src} alt={current.alt} />
        ) : null}
        <div className="viewer__bar fact">
          <button type="button" className="btn btn--paper" onClick={() => show(at - 1)} disabled={tiles.length < 2}>
            Previous
          </button>
          <p>{current?.caption}</p>
          <button type="button" className="btn btn--paper" onClick={() => show(at + 1)} disabled={tiles.length < 2}>
            Next
          </button>
        </div>
      </dialog>
    </>
  );
}
