import { isPublicGalleryImage } from "@/lib/gallery-visibility";
import { prisma } from "@/lib/prisma";

export async function getPublishedServices() {
  return prisma.service.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { startingAt: "asc" }]
  });
}

// 4.21-4.23 / LEG-9: public pages show only uploaded shoots, never the repo's sample
// photos or outside (stock) links, even if a row is marked published.
export async function getPublishedGalleryImages() {
  const images = await prisma.galleryImage.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }]
  });
  return images.filter((image) => isPublicGalleryImage(image.imageUrl, process.env.BLOB_READ_WRITE_TOKEN));
}

export async function getFeaturedGalleryImages(take = 3) {
  const images = await prisma.galleryImage.findMany({
    where: { published: true, featured: true },
    take: take + 30,
    orderBy: { createdAt: "desc" }
  });
  return images.filter((image) => isPublicGalleryImage(image.imageUrl, process.env.BLOB_READ_WRITE_TOKEN)).slice(0, take);
}
