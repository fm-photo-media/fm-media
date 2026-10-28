import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteGalleryImage, updateGalleryImage } from "@/app/actions";
import { AdminNotice } from "@/app/admin/admin-fields";
import { GalleryImageForm } from "@/app/admin/gallery/gallery-image-form";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Gallery Image",
  robots: { index: false, follow: false }
};

export default async function EditGalleryImagePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const notice = await searchParams;

  const image = await prisma.galleryImage.findUnique({
    where: { id },
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
      <SectionHeading level="h1" eyebrow="Admin" title={`Edit ${image.title}`} copy="Update labels, dimensions, visibility, or replace the uploaded image file." />
      <AdminNotice error={notice.error} success={notice.success} />

      <article className="mt-8 rounded-lg border border-line bg-white p-5">
        <div className="mb-6 overflow-hidden rounded-lg border border-line bg-mist">
          <Image
            src={image.imageUrl}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="h-auto w-full object-cover"
            sizes="(min-width: 1024px) 768px, 100vw"
          />
        </div>
        {/* QA-6: the same form as "Add", so a replacement over ~1 MB goes browser -> Blob. */}
        <GalleryImageForm
          action={updateGalleryImage}
          defaults={image}
          fileLabel="Replace Image File (optional)"
          submitLabel="Save Changes"
        />
        <form action={deleteGalleryImage} className="mt-8">
          <input type="hidden" name="id" value={image.id} />
          <input type="hidden" name="returnTo" value={`/admin/gallery/${image.id}`} />
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
