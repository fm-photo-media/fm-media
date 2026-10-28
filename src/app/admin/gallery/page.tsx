import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createGalleryImage, deleteGalleryImage } from "@/app/actions";
import { AdminNotice, ConfirmDelete } from "@/app/admin/admin-fields";
import { AdminShell } from "@/app/admin/admin-shell";
import { GalleryImageForm } from "@/app/admin/gallery/gallery-image-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { countLabel, galleryCategories, galleryPhoneLine, gallerySummary } from "@/lib/admin-view";
import { canRenderGalleryImage, galleryImageNotice, isPublicGalleryImage } from "@/lib/gallery-visibility";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  robots: { index: false, follow: false }
};

// Batch 5b (design.md "Gallery", note 7): h1 plus a computed subline, the upload panel, and
// every photo with a 72px 3:2 thumbnail (our own store only, LEG-9), its title and alt text,
// shoot and town, category, whether it's on the site (and why not), Edit and an inline delete.

export default async function AdminGalleryPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; upload?: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const notice = await searchParams;
  const uploadOpen = notice.upload === "1" || Boolean(notice.error);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const [total, images, used] = await Promise.all([
    prisma.galleryImage.count(),
    prisma.galleryImage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, alt: true, category: true, shoot: true, town: true, imageUrl: true, featured: true, published: true }
    }),
    prisma.galleryImage.findMany({ distinct: ["category"], select: { category: true } })
  ]);
  const categories = galleryCategories(used.map((row) => row.category));
  const all = total <= images.length ? images : await prisma.galleryImage.findMany({ select: { imageUrl: true, featured: true, published: true } });
  const onSite = all.filter((image) => image.published && isPublicGalleryImage(image.imageUrl, token));
  const summary = gallerySummary({ total, onSite: onSite.length, featured: onSite.filter((image) => image.featured).length });

  return (
    <AdminShell current="gallery" crumb={<b>Gallery</b>}>
      <div className="ad-title">
        <div>
          <h1>Gallery</h1>
          <p className="tnum">
            <b>{summary}</b> Only photos from your own shoots go on the public site.
          </p>
        </div>
        <Link className="ad-btn ad-btn--primary" href="/admin/gallery?upload=1#upload">
          Upload a photo
        </Link>
      </div>

      <AdminNotice error={notice.error} success={notice.success} />

      {/* DES-41 / DES-49: the panel is rendered only when it's open, so the list leads and the
          header button is the one "Upload a photo" control. It opens with ?upload=1 (the header
          button) or on any upload error, so a refused upload shows its form again. */}
      {uploadOpen ? (
        <section className="ad-panel ad-upload" id="upload" aria-labelledby="upload-heading">
          <div className="ad-panel__head ad-upload__head">
            <div>
              <h2 id="upload-heading">Upload a photo</h2>
              <p>One photo at a time. The size is read from the file.</p>
            </div>
            <Link className="ad-upload__close" href="/admin/gallery" aria-label="Close the upload panel">
              Close
            </Link>
          </div>
          <GalleryImageForm
            action={createGalleryImage}
            fileLabel="Photo file"
            submitLabel="Upload"
            formLabel="Upload a photo"
            categories={categories}
            requireFile
          />
        </section>
      ) : null}

      <section className="ad-panel" aria-labelledby="all-heading">
        <div className="ad-panel__head">
          <h2 id="all-heading">All photos</h2>
          <p className="tnum">{total > images.length ? `The ${images.length} most recently changed of ${total}` : `${countLabel(total, "photo")}, most recently changed first`}</p>
        </div>
        {images.length === 0 ? (
          <p className="ad-empty">No photos yet. Upload one from your own shoots above.</p>
        ) : (
          <table className="ad-rows ad-rows--list ad-rows--gallery">
            <thead>
              <tr>
                <th scope="col">Photo</th>
                <th scope="col">Title and alt text</th>
                <th scope="col">Shoot</th>
                <th scope="col">Category</th>
                <th scope="col">On the site</th>
                <th scope="col" className="ad-num">
                  <span className="ad-vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {images.map((image) => {
                const hiddenWhy = galleryImageNotice(image.imageUrl, token);
                const live = image.published && !hiddenWhy;
                return (
                  <tr key={image.id}>
                    <td className="ad-thumbcell">
                      {/* LEG-9: outside links are never loaded; a plain box stands in.
                          DES-48: the alt text rides on the thumbnail, since the phone row hides its line. */}
                      {canRenderGalleryImage(image.imageUrl, token) ? (
                        <Image src={image.imageUrl} alt={image.alt} width={72} height={48} sizes="72px" className="ad-thumb" />
                      ) : (
                        <span className="ad-thumb ad-thumb--none">Not shown</span>
                      )}
                    </td>
                    {/* DES-48: the phone layout (<=640px): the thumbnail beside the title, one grey
                        line (shoot and town as on the site, category, and Hidden only when hidden),
                        then Edit and Delete from the actions cell. */}
                    <td className="ad-phone">
                      <b>{image.title}</b>
                      <p className="ad-phone__l2">{galleryPhoneLine({ ...image, live })}</p>
                    </td>
                    <td>
                      <b>{image.title}</b>
                      <span className="ad-sub">{image.alt || <span className="ad-dash">No alt text yet</span>}</span>
                    </td>
                    <td data-l="Shoot">
                      {image.shoot || image.town ? (
                        <>
                          {image.shoot || <span className="ad-dash">—</span>}
                          {image.town ? <span className="ad-sub">{image.town}</span> : null}
                        </>
                      ) : (
                        <span className="ad-dash">—</span>
                      )}
                    </td>
                    <td data-l="Category">{image.category}</td>
                    <td>
                      {live ? <span className="ad-tag ad-tag--pos">Published</span> : <span className="ad-tag ad-tag--off">Hidden</span>}
                      {live && image.featured ? <span className="ad-sub">Featured on home</span> : null}
                      {hiddenWhy ? <span className="ad-sub">{hiddenWhy}</span> : null}
                    </td>
                    <td className="ad-num">
                      <div className="ad-actions">
                        <Link className="ad-btn ad-btn--text" href={`/admin/gallery/${image.id}`} aria-label={`Edit ${image.title}`}>
                          Edit
                        </Link>
                        <ConfirmDelete
                          summary="Delete"
                          summaryLabel={`Delete ${image.title}`}
                          question={`Delete “${image.title}” and its file? This can't be undone.`}
                          action={deleteGalleryImage}
                          confirmLabel="Delete photo"
                          confirmAriaLabel={`Yes, delete ${image.title} and its file`}
                        >
                          <input type="hidden" name="id" value={image.id} />
                          <input type="hidden" name="returnTo" value="/admin/gallery" />
                        </ConfirmDelete>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
