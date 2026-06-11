import { prisma } from "@/lib/prisma";

export async function getPublishedServices() {
  return prisma.service.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { startingAt: "asc" }]
  });
}

export async function getPublishedGalleryImages() {
  return prisma.galleryImage.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }]
  });
}

export async function getFeaturedGalleryImages(take = 3) {
  return prisma.galleryImage.findMany({
    where: { published: true, featured: true },
    take,
    orderBy: { createdAt: "desc" }
  });
}
