import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createGalleryImage, deleteGalleryImage } from "@/app/actions";
import { AdminNotice } from "@/app/admin/admin-fields";
import { GalleryImageForm } from "@/app/admin/gallery/gallery-image-form";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { canRenderGalleryImage, galleryImageNotice } from "@/lib/gallery-visibility";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Gallery",
  robots: { index: false, follow: false }
};

export default async function AdminGalleryPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const notice = await searchParams;
  const images = await prisma.galleryImage.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      alt: true,
      category: true,
      imageUrl: true,
      featured: true,
      published: true
    }
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="focus-ring text-sm font-semibold text-clay hover:text-ink">
        Back to Admin
      </Link>
      <SectionHeading level="h1" eyebrow="Admin" title="Manage gallery images." copy="Upload photos from your own shoots, update labels, and choose featured portfolio images. Only your own uploads show on the public site." />
      <AdminNotice error={notice.error} success={notice.success} />

      <section className="mt-10 rounded-lg border border-line bg-white p-5">
        <h2 className="font-serif text-2xl">Add Gallery Image</h2>
        <GalleryImageForm action={createGalleryImage} fileLabel="Choose Image File" submitLabel="Add Image" requireFile />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Gallery Images</h2>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-mist text-ink">
              <tr>
                <th className="px-4 py-3">
                  <span className="sr-only">Preview</span>
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Edit</th>
                <th className="px-4 py-3">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">{/* taste-skill-ignore: rows of a real data table */}
              {images.map((image) => (
                <tr key={image.id}>
                  <td className="px-4 py-3">
                    {/* Research (admin): a thumbnail, so the owner can check what is published. */}
                    {/* LEG-9: outside links are never loaded; a plain box stands in. */}
                    {canRenderGalleryImage(image.imageUrl, process.env.BLOB_READ_WRITE_TOKEN) ? (
                      <Image
                        src={image.imageUrl}
                        alt={image.alt}
                        width={96}
                        height={64}
                        sizes="96px"
                        className="h-16 w-24 rounded border border-line bg-mist object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-24 items-center justify-center rounded border border-line bg-mist text-xs text-ink/70">
                        Not shown
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{image.title}</td>
                  <td className="px-4 py-3 text-ink/70">{image.category}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {image.published ? "Published" : "Hidden"}
                    {image.featured ? " / Featured" : ""}
                    {galleryImageNotice(image.imageUrl, process.env.BLOB_READ_WRITE_TOKEN) ? (
                      <span className="mt-1 block max-w-xs text-xs leading-5 text-ink/70">{galleryImageNotice(image.imageUrl, process.env.BLOB_READ_WRITE_TOKEN)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/gallery/${image.id}`} className="focus-ring text-sm font-semibold text-clay hover:text-ink">
                      Edit
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteGalleryImage} className="flex items-center gap-3">
                      <input type="hidden" name="id" value={image.id} />
                      <input type="hidden" name="returnTo" value="/admin/gallery" />
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
                  <td className="px-4 py-6 text-ink/60" colSpan={6}>
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
