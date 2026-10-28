import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteGalleryImage, updateGalleryImage } from "@/app/actions";
import { AdminNotice, ConfirmDelete } from "@/app/admin/admin-fields";
import { AdminShell } from "@/app/admin/admin-shell";
import { GalleryImageForm } from "@/app/admin/gallery/gallery-image-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { galleryCategories } from "@/lib/admin-view";
import { BOOKING_TIME_ZONE } from "@/lib/booking-time";
import { canRenderGalleryImage, galleryImageNotice } from "@/lib/gallery-visibility";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit photo",
  robots: { index: false, follow: false }
};

const uploadedFormat = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });

// Batch 5b (design.md "Gallery edit"): breadcrumb, h1 = title, a meta line (pixel size,
// upload date, state) and "See it on the site". A large preview on the left, the details on
// the right, then a danger section to delete the photo and its file.

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
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const [image, used] = await Promise.all([
    prisma.galleryImage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        alt: true,
        category: true,
        shoot: true,
        town: true,
        imageUrl: true,
        width: true,
        height: true,
        featured: true,
        published: true,
        createdAt: true
      }
    }),
    prisma.galleryImage.findMany({ distinct: ["category"], select: { category: true } })
  ]);

  if (!image) {
    notFound();
  }

  const hiddenWhy = galleryImageNotice(image.imageUrl, token);
  const live = image.published && !hiddenWhy;
  const { createdAt, ...defaults } = image;

  return (
    <AdminShell
      current="gallery"
      crumb={
        <>
          <Link href="/admin/gallery" aria-label="Back to Gallery">Gallery</Link> / <b>{image.title}</b>
        </>
      }
    >
      <div className="ad-title">
        <div>
          <h1>{image.title}</h1>
          <p className="tnum">
            {image.width} × {image.height} px · uploaded <time dateTime={createdAt.toISOString()}>{uploadedFormat.format(createdAt)}</time> ·{" "}
            {live ? (image.featured ? "published, featured on home" : "published") : "hidden"}
          </p>
        </div>
        {live ? (
          <Link className="ad-btn" href="/portfolio">
            See it on the site
          </Link>
        ) : null}
      </div>

      <AdminNotice error={notice.error} success={notice.success} />

      <div className="ad-detail">
        <figure className="ad-panel ad-detail__img">
          {canRenderGalleryImage(image.imageUrl, token) ? (
            <Image
              src={image.imageUrl}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1440px) 660px, (min-width: 901px) 55vw, 100vw"
            />
          ) : null}
          {hiddenWhy ? <figcaption className="ad-detail__none">{hiddenWhy}</figcaption> : null}
        </figure>
        <section className="ad-panel" aria-labelledby="details-heading">
          <div className="ad-panel__head">
            <h2 id="details-heading">Photo details</h2>
          </div>
          {/* QA-6: the same form as "Upload", so a replacement over 900 KB goes browser -> Blob. */}
          <GalleryImageForm
            action={updateGalleryImage}
            defaults={defaults}
            fileLabel="Replace the image (optional)"
            fileHint="The old file is deleted from storage when the new one is saved."
            submitLabel="Save changes"
            formLabel="Photo details"
            categories={galleryCategories(used.map((row) => row.category))}
          />
        </section>
      </div>

      <section className="ad-danger" aria-labelledby="danger-heading">
        <div>
          <h2 id="danger-heading">Delete this photo</h2>
          <p>Removes it from the site and deletes the file from storage. This can&apos;t be undone.</p>
        </div>
        <ConfirmDelete
          summary="Delete photo"
          question={`Delete “${image.title}” and its file?`}
          action={deleteGalleryImage}
          confirmLabel="Yes, delete photo"
          className="ad-confirm--danger"
        >
          <input type="hidden" name="id" value={image.id} />
          <input type="hidden" name="returnTo" value={`/admin/gallery/${image.id}`} />
        </ConfirmDelete>
      </section>
    </AdminShell>
  );
}
