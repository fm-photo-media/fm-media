import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createGalleryImage, deleteGalleryImage } from "@/app/actions";
import { AdminNotice } from "@/app/admin/admin-fields";
import { GalleryImageForm } from "@/app/admin/gallery/gallery-image-form";
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
        <GalleryImageForm action={createGalleryImage} fileLabel="Choose Image File" submitLabel="Add Image" requireFile />
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
