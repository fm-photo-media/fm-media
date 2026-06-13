import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteGalleryImage, updateGalleryImage } from "@/app/actions";
import { GalleryImageForm } from "@/app/admin/gallery/gallery-image-form";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Gallery Image",
  robots: { index: false, follow: false }
};

export default async function EditGalleryImagePage({ params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const image = await prisma.galleryImage.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      alt: true,
      category: true,
      imageUrl: true,
      width: true,
      height: true,
      featured: true,
      published: true
    }
  });

  if (!image) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/gallery" className="focus-ring text-sm font-semibold text-clay hover:text-ink">
        Back to Gallery
      </Link>
      <SectionHeading eyebrow="Admin" title={`Edit ${image.title}`} copy="Update labels, dimensions, visibility, or replace the uploaded image file." />

      <article className="mt-8 rounded-lg border border-line bg-white p-5 shadow-sm">
        <GalleryImageForm action={updateGalleryImage} defaults={image} fileLabel="Replace Image File" submitLabel="Save" />
        <form action={deleteGalleryImage} className="mt-6 border-t border-line pt-4">
          <input type="hidden" name="id" value={image.id} />
          <label className="mr-4 inline-flex items-center gap-2 text-sm text-ink/70">
            <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
            Confirm delete
          </label>
          <button className="focus-ring text-sm font-semibold text-clay">Delete image</button>
        </form>
      </article>
    </main>
  );
}
