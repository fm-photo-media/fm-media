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

// The no-photo treatment (404): the blue logo mark on a 1:1 tint square, never a sample or
// stock image. Batch 8 (design.md "Build spec: Variant B", 404): columns 8-12, hidden <=900px.
export function BrandPanel({ className = "nf__mark" }: { className?: string }) {
  return (
    <div className={className}>
      <Image src="/brand/logo-mark.png" width={564} height={377} alt="" sizes="30vw" />
    </div>
  );
}
