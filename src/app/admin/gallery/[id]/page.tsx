import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteGalleryImage, updateGalleryImage } from "@/app/actions";
import { AdminNotice, Checkbox, FileInput, TextInput } from "@/app/admin/admin-fields";
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
  params: { id: string };
  searchParams?: { error?: string; success?: string };
}) {
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
      <AdminNotice error={searchParams?.error} success={searchParams?.success} />

      <article className="mt-8 rounded-lg border border-line bg-white p-5 shadow-sm">
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
        <form action={updateGalleryImage} className="mt-5 grid gap-4">
          <input type="hidden" name="id" value={image.id} />
          <input type="hidden" name="imageUrl" value={image.imageUrl} />
          <TextInput name="title" label="Title" defaultValue={image.title} />
          <TextInput name="alt" label="Alt Text" defaultValue={image.alt} />
          <TextInput name="category" label="Category" defaultValue={image.category} />
          <FileInput name="imageFile" label="Replace Image File" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="width" label="Width" type="number" defaultValue={image.width} />
            <TextInput name="height" label="Height" type="number" defaultValue={image.height} />
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Checkbox name="featured" label="Featured" defaultChecked={image.featured} />
            <Checkbox name="published" label="Published" defaultChecked={image.published} />
            <button className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Save Changes</button>
          </div>
        </form>
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
