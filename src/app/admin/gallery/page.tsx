import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createGalleryImage, deleteGalleryImage } from "@/app/actions";
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
        category: true,
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
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-mist text-ink">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Edit</th>
                <th className="px-4 py-3">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {images.map((image) => (
                <tr key={image.id}>
                  <td className="px-4 py-3 font-medium text-ink">{image.title}</td>
                  <td className="px-4 py-3 text-ink/70">{image.category}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {image.published ? "Published" : "Hidden"}
                    {image.featured ? " / Featured" : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/gallery/${image.id}`} className="focus-ring text-sm font-semibold text-clay hover:text-ink">
                      Edit
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteGalleryImage} className="flex items-center gap-3">
                      <input type="hidden" name="id" value={image.id} />
                      <label className="flex items-center gap-2 text-xs font-medium text-ink/70">
                        <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
                        Confirm
                      </label>
                      <button className="focus-ring text-sm font-semibold text-clay">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
              {images.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-ink/60" colSpan={5}>
                    No gallery images yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
