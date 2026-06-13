import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteInquiry, logoutAdmin, updateInquiryContacted } from "@/app/actions";
import { AdminNotice } from "@/app/admin/admin-fields";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

export default async function AdminPage({ searchParams }: { searchParams?: { error?: string; success?: string } }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [serviceCount, galleryCount, inquiryCount, inquiries] = await Promise.all([
    prisma.service.count(),
    prisma.galleryImage.count(),
    prisma.inquiry.count(),
    prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        agencyName: true,
        propertyAddress: true,
        propertySize: true,
        photoPackage: true,
        addOns: true,
        videoService: true,
        firstShootOffer: true,
        preferredDate: true,
        preferredTime: true,
        status: true
      }
    })
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          eyebrow="Admin"
          title="FM Media dashboard"
          copy="Review booking requests and jump into services or gallery management."
        />
        <form action={logoutAdmin}>
          <button className="focus-ring rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold text-ink hover:border-clay">
            Sign Out
          </button>
        </form>
      </div>

      <AdminNotice error={searchParams?.error} success={searchParams?.success} />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Inquiries", inquiryCount, "#inquiries"],
          ["Services", serviceCount, "/admin/services"],
          ["Gallery Images", galleryCount, "/admin/gallery"]
        ].map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)} className="focus-ring rounded-lg border border-line bg-white p-5 shadow-sm hover:border-clay">
            <p className="text-sm font-semibold text-ink/60">{label}</p>
            <p className="mt-2 font-serif text-4xl text-ink">{value}</p>
          </Link>
        ))}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/admin/services" className="focus-ring rounded-lg border border-line bg-white p-6 shadow-sm hover:border-clay">
          <h2 className="font-serif text-2xl text-ink">Manage Services</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Add, edit, publish, feature, or delete service packages.</p>
        </Link>
        <Link href="/admin/gallery" className="focus-ring rounded-lg border border-line bg-white p-6 shadow-sm hover:border-clay">
          <h2 className="font-serif text-2xl text-ink">Manage Gallery</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Upload images, edit portfolio metadata, and choose featured photos.</p>
        </Link>
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
                    <span className="font-semibold text-ink">{inquiry.photoPackage || "No photo package selected"}</span>
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
                        <input name="contacted" type="checkbox" defaultChecked={inquiry.status === "CONTACTED"} className="h-4 w-4 accent-clay" />
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
                      <button className="focus-ring w-fit text-sm font-semibold text-clay">Delete</button>
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
    </main>
  );
}
