import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  createGalleryImage,
  createService,
  deleteGalleryImage,
  deleteInquiry,
  deleteService,
  logoutAdmin,
  updateGalleryImage,
  updateInquiryContacted,
  updateService
} from "@/app/actions";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = true
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="rounded-md border border-line px-3 py-2 font-normal"
      />
    </label>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-ink">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-clay" />
      {label}
    </label>
  );
}

const adminErrors: Record<string, string> = {
  "confirm-delete": "Check the confirmation box before deleting.",
  "invalid-service": "Service details are incomplete or invalid.",
  "invalid-image": "Gallery image details are incomplete or use an unsupported image URL."
};

export default async function AdminPage({ searchParams }: { searchParams?: { error?: string } }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [services, images, inquiries] = await Promise.all([
    prisma.service.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.galleryImage.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 25 })
  ]);

  const adminNav = [
    { href: "#overview", label: "Overview", copy: "Counts and quick status" },
    { href: "#inquiries", label: "Inquiries", copy: "Recent booking requests" },
    { href: "#add-new", label: "Add New", copy: "Create services and images" },
    { href: "#services", label: "Services", copy: "Packages and pricing" },
    { href: "#gallery", label: "Gallery", copy: "Portfolio images" }
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-lg border border-line bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-clay">Admin Menu</p>
          <nav aria-label="Admin sections" className="mt-4 grid gap-2">
            {adminNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="focus-ring rounded-md border border-transparent px-3 py-2 text-sm font-semibold text-ink transition hover:border-line hover:bg-mist"
              >
                <span className="block">{item.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-ink/60">{item.copy}</span>
              </a>
            ))}
          </nav>
          <form action={logoutAdmin} className="mt-5 border-t border-line pt-4">
            <button className="focus-ring w-full rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold text-ink hover:border-clay">
              Sign Out
            </button>
          </form>
        </aside>

        <div className="min-w-0">
          <SectionHeading
            eyebrow="Admin"
            title="Manage services, portfolio images, and shoot requests."
            copy="Use the sidebar to jump between inquiries, pricing packages, and gallery content. Public pages stay fast while admin work reads and writes directly to PostgreSQL."
          />
          {searchParams?.error ? (
            <p className="mt-4 rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-clay" role="alert">
              {adminErrors[searchParams.error] ?? "Something needs attention before saving."}
            </p>
          ) : null}

          <section id="overview" className="mt-8 scroll-mt-24">
            <h2 className="font-serif text-3xl">Overview</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-ink/60">Recent inquiries</p>
                <p className="mt-2 font-serif text-4xl text-ink">{inquiries.length}</p>
              </div>
              <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-ink/60">Services</p>
                <p className="mt-2 font-serif text-4xl text-ink">{services.length}</p>
              </div>
              <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-ink/60">Gallery images</p>
                <p className="mt-2 font-serif text-4xl text-ink">{images.length}</p>
              </div>
            </div>
          </section>

          <section id="add-new" className="mt-12 scroll-mt-24">
            <div className="mb-5">
              <h2 className="font-serif text-3xl">Add New</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                Add new package cards and portfolio images here. Existing items can be edited in their own sections below.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="font-serif text-2xl">Add Service</h2>
          <form action={createService} className="mt-5 grid gap-4">
            <TextInput name="title" label="Title" />
            <TextInput name="slug" label="Slug" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput name="category" label="Category" defaultValue="PHOTO" />
              <TextInput name="priceLabel" label="Display Price" required={false} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextInput name="bestUse" label="Best-Use Label" required={false} />
              <TextInput name="squareFeet" label="Square Footage" required={false} />
              <TextInput name="sortOrder" label="Sort Order" type="number" defaultValue={0} />
            </div>
            <TextInput name="summary" label="Summary" />
            <label className="grid gap-1 text-sm font-medium text-ink">
              Description
              <textarea name="description" required rows={4} className="rounded-md border border-line px-3 py-2 font-normal" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextInput name="startingAt" label="Starting At" type="number" />
              <TextInput name="deliverable" label="Deliverable" />
              <TextInput name="turnaround" label="Turnaround" />
            </div>
            <div className="flex flex-wrap gap-5">
              <Checkbox name="featured" label="Featured" />
              <Checkbox name="published" label="Published" defaultChecked />
            </div>
            <button className="focus-ring w-fit rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Add Service</button>
          </form>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="font-serif text-2xl">Add Gallery Image</h2>
          <form action={createGalleryImage} className="mt-5 grid gap-4">
            <TextInput name="title" label="Title" />
            <TextInput name="alt" label="Alt Text" />
            <TextInput name="category" label="Category" />
            <TextInput name="imageUrl" label="Image URL or Local Path" />
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
        </div>
            </div>
      </section>

      <section id="services" className="mt-12 scroll-mt-24">
        <h2 className="font-serif text-3xl">Services</h2>
        <div className="mt-5 grid gap-5">
          {services.map((service) => (
            <article key={service.id} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <form action={updateService} className="grid gap-4">
                <input type="hidden" name="id" value={service.id} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <TextInput name="title" label="Title" defaultValue={service.title} />
                  <TextInput name="slug" label="Slug" defaultValue={service.slug} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput name="category" label="Category" defaultValue={service.category} />
                  <TextInput name="priceLabel" label="Display Price" defaultValue={service.priceLabel ?? ""} required={false} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput name="bestUse" label="Best-Use Label" defaultValue={service.bestUse ?? ""} required={false} />
                  <TextInput name="squareFeet" label="Square Footage" defaultValue={service.squareFeet ?? ""} required={false} />
                  <TextInput name="sortOrder" label="Sort Order" type="number" defaultValue={service.sortOrder} />
                </div>
                <TextInput name="summary" label="Summary" defaultValue={service.summary} />
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Description
                  <textarea
                    name="description"
                    required
                    rows={3}
                    defaultValue={service.description}
                    className="rounded-md border border-line px-3 py-2 font-normal"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput name="startingAt" label="Starting At" type="number" defaultValue={service.startingAt} />
                  <TextInput name="deliverable" label="Deliverable" defaultValue={service.deliverable} />
                  <TextInput name="turnaround" label="Turnaround" defaultValue={service.turnaround} />
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <Checkbox name="featured" label="Featured" defaultChecked={service.featured} />
                  <Checkbox name="published" label="Published" defaultChecked={service.published} />
                  <button className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Save</button>
                </div>
              </form>
              <form action={deleteService} className="mt-3">
                <input type="hidden" name="id" value={service.id} />
                <label className="mr-4 inline-flex items-center gap-2 text-sm text-ink/70">
                  <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
                  Confirm delete
                </label>
                <button className="focus-ring text-sm font-semibold text-clay">Delete service</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section id="gallery" className="mt-12 scroll-mt-24">
        <h2 className="font-serif text-3xl">Gallery Images</h2>
        <div className="mt-5 grid gap-5">
          {images.map((image) => (
            <article key={image.id} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <form action={updateGalleryImage} className="grid gap-4">
                <input type="hidden" name="id" value={image.id} />
                <div className="grid gap-4 lg:grid-cols-3">
                  <TextInput name="title" label="Title" defaultValue={image.title} />
                  <TextInput name="category" label="Category" defaultValue={image.category} />
                  <TextInput name="imageUrl" label="Image URL or Local Path" defaultValue={image.imageUrl} />
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
        </div>
      </section>

      <section id="inquiries" className="mt-12 scroll-mt-24">
        <h2 className="font-serif text-3xl">Recent Inquiries</h2>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-mist text-ink">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Preferred</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Contacted</th>
                <th className="px-4 py-3">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td className="px-4 py-3 font-medium text-ink">{inquiry.name}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {inquiry.email}
                    <br />
                    {inquiry.phone}
                    {inquiry.agencyName ? (
                      <>
                        <br />
                        {inquiry.agencyName}
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <span className="font-semibold text-ink">
                      {inquiry.photoPackage || "No photo package selected"}
                    </span>
                    <br />
                    {inquiry.videoService}
                    {inquiry.addOns ? (
                      <>
                        <br />
                        {inquiry.addOns}
                      </>
                    ) : null}
                    {inquiry.firstShootOffer ? (
                      <>
                        <br />
                        Free first-shoot drone photos
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {inquiry.preferredDate.toLocaleDateString()}
                    <br />
                    {inquiry.preferredTime}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {inquiry.propertyAddress}
                    <br />
                    {inquiry.propertySize}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateInquiryContacted} className="flex items-center gap-3">
                      <input type="hidden" name="id" value={inquiry.id} />
                      <label className="flex items-center gap-2 text-sm font-medium text-ink">
                        <input
                          name="contacted"
                          type="checkbox"
                          defaultChecked={inquiry.status === "CONTACTED"}
                          className="h-4 w-4 accent-clay"
                        />
                        Yes
                      </label>
                      <button className="focus-ring rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:border-clay">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteInquiry} className="grid gap-2">
                      <input type="hidden" name="id" value={inquiry.id} />
                      <label className="flex items-center gap-2 text-xs font-medium text-ink/70">
                        <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
                        Confirm
                      </label>
                      <button className="focus-ring w-fit text-sm font-semibold text-clay">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {inquiries.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-ink/60" colSpan={7}>
                    No inquiries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
        </div>
      </div>
    </main>
  );
}
