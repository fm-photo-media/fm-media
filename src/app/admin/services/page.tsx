import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createService, deleteService, updateService } from "@/app/actions";
import { AdminNotice, Checkbox, TextInput } from "@/app/admin/admin-fields";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Services",
  robots: { index: false, follow: false }
};

export default async function AdminServicesPage({ searchParams }: { searchParams?: { error?: string; success?: string } }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const services = await prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="focus-ring text-sm font-semibold text-clay hover:text-ink">
        Back to Admin
      </Link>
      <SectionHeading eyebrow="Admin" title="Manage services and packages." copy="Add, edit, publish, feature, or delete pricing packages." />
      <AdminNotice error={searchParams?.error} success={searchParams?.success} />

      <section className="mt-10 rounded-lg border border-line bg-white p-5 shadow-sm">
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
      </section>

      <section className="mt-12">
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
                  <textarea name="description" required rows={3} defaultValue={service.description} className="rounded-md border border-line px-3 py-2 font-normal" />
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
    </main>
  );
}
