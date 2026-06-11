import Image from "next/image";
import type { GalleryImage } from "@prisma/client";

type GalleryGridProps = {
  images: GalleryImage[];
  priorityFirst?: boolean;
};

export function GalleryGrid({ images, priorityFirst = false }: GalleryGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => (
        <figure key={image.id} className="group overflow-hidden rounded-lg bg-white shadow-soft">
          <div className="relative aspect-[4/3]">
            <Image
              src={image.imageUrl}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              priority={priorityFirst && index === 0}
            />
          </div>
          <figcaption className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="font-medium text-ink">{image.title}</span>
            <span className="text-ink/55">{image.category}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
