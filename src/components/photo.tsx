import Image from "next/image";

// Batch 5 (design.md "Photo frame"; DES-7): native 3:2, square corners, no shadow. Only
// Francisco's own uploads ever reach this (gallery-visibility.ts); there is no
// placeholder tag, because no sample or stock picture is ever shown.
export function Photo({
  src,
  alt,
  sizes,
  priority = false,
  className = ""
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`ph ph--32 ${className}`.trim()}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
    </figure>
  );
}

// The no-photo treatment: until Francisco uploads his own shoot, the slot shows his
// card's mark on the tint field, never a sample or stock image.
export function BrandPanel({ className = "" }: { className?: string }) {
  return (
    <div className={`ph ph--32 ph--brand ${className}`.trim()}>
      <Image src="/brand/logo-mark.png" alt="" fill sizes="(max-width: 640px) 100vw, 58vw" />
    </div>
  );
}
