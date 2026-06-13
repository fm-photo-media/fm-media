import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createGalleryImage, deleteGalleryImage, updateGalleryImage } from "@/app/actions";
import { AdminNotice, Checkbox, FileInput, TextInput } from "@/app/admin/admin-fields";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Gallery",
  robots: { index: false, follow: false }
};

export default async function AdminGalleryPage({ searchParams }: { searchParams?: { error?: string; success?: string } }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const images = await prisma.galleryImage.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      alt: true,
      category: true,
      width: true,
      height: true,
      featured: true,
      published: true
    }
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="focus-ring text-sm font-semibold text-clay hover:text-ink">
        Back to Admin
      </Link>
      <SectionHeading eyebrow="Admin" title="Manage gallery images." copy="Upload listing photos, update labels, and choose featured portfolio images." />
      <AdminNotice error={searchParams?.error} success={searchParams?.success} />

      <section className="mt-10 rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="font-serif text-2xl">Add Gallery Image</h2>
        <form action={createGalleryImage} className="mt-5 grid gap-4">
          <TextInput name="title" label="Title" />
          <TextInput name="alt" label="Alt Text" />
          <TextInput name="category" label="Category" />
          <FileInput name="imageFile" label="Choose Image File" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="width" label="Width" type="number" defaultValue={1600} />
            <TextInput name="height" label="Height" type="number" defaultValue={1100} />
          </div>
          <div className="flex flex-wrap gap-5">
            <Checkbox name="featured" label="Featured" />
            <Checkbox name="published" label="Published" defaultChecked />
          </div>
          <button className="focus-ring w-fit rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Add Image</button>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Gallery Images</h2>
        <div className="mt-5 grid gap-5">
          {images.map((image) => (
            <article key={image.id} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <form action={updateGalleryImage} className="grid gap-4">
                <input type="hidden" name="id" value={image.id} />
                <div className="grid gap-4 lg:grid-cols-3">
                  <TextInput name="title" label="Title" defaultValue={image.title} />
                  <TextInput name="category" label="Category" defaultValue={image.category} />
                  <FileInput name="imageFile" label="Replace Image File" />
                </div>
                <TextInput name="alt" label="Alt Text" defaultValue={image.alt} />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput name="width" label="Width" type="number" defaultValue={image.width} />
                  <TextInput name="height" label="Height" type="number" defaultValue={image.height} />
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <Checkbox name="featured" label="Featured" defaultChecked={image.featured} />
                  <Checkbox name="published" label="Published" defaultChecked={image.published} />
                  <button className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Save</button>
                </div>
              </form>
              <form action={deleteGalleryImage} className="mt-3">
                <input type="hidden" name="id" value={image.id} />
                <label className="mr-4 inline-flex items-center gap-2 text-sm text-ink/70">
                  <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
                  Confirm delete
                </label>
                <button className="focus-ring text-sm font-semibold text-clay">Delete image</button>
              </form>
            </article>
          ))}
          {images.length === 0 ? (
            <p className="rounded-lg border border-line bg-white p-5 text-sm text-ink/60">No gallery images yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
