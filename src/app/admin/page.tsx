import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { deleteInquiry, logoutAdmin, logoutAllAdminSessions, purgeOldInquiries, updateInquiryContacted } from "@/app/actions";
import { AdminNotice } from "@/app/admin/admin-fields";
import { SectionHeading } from "@/components/section-heading";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { lastAutoPurgeAt, runAutoPurge } from "@/lib/auto-purge-db";
import { BOOKING_TIME_ZONE, formatStoredDate } from "@/lib/booking-time";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_ISSUE_STATUSES,
  INQUIRY_FILTERS,
  inquiryFilterFrom,
  inquiryPage,
  monthsBefore,
  retentionMonthsFrom,
  type InquiryFilter
} from "@/lib/retention";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

type SearchParams = { error?: string; success?: string; count?: string; page?: string; status?: string };

const EMAIL_STATUS_LABELS: Record<string, { label: string; followUp: boolean }> = {
  SENT: { label: "Email sent", followUp: false },
  FAILED: { label: "Email failed: follow up", followUp: true },
  SKIPPED_CAP: { label: "Email not sent (daily email cap reached): follow up", followUp: true },
  SKIPPED: { label: "Email not configured (local only)", followUp: false },
  PENDING: { label: "Email pending", followUp: false },
  UNKNOWN: { label: "Email status unknown (booked before Oct 2026)", followUp: false }
};

function emailStatus(status: string) {
  return EMAIL_STATUS_LABELS[status] ?? { label: `Email: ${status}`, followUp: false };
}

const receivedFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short"
});

function filterWhere(filter: InquiryFilter): Prisma.InquiryWhereInput {
  if (filter === "NEW" || filter === "CONTACTED") return { status: filter };
  if (filter === "email-issue") return { emailStatus: { in: [...EMAIL_ISSUE_STATUSES] } };
  return {};
}

function listHref(filter: InquiryFilter, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin${query ? `?${query}` : ""}#inquiries`;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-ink/60">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const query = await searchParams;
  const filter = inquiryFilterFrom(query.status);
  const where = filterWhere(filter);
  const retentionMonths = retentionMonthsFrom(process.env);
  const retentionCutoff = monthsBefore(new Date(), retentionMonths);

  // LEG-1 / Ship condition A1: delete inquiries past the retention period first, so the
  // counts below are current. At most about once an hour; never throws (auto-purge.ts).
  await runAutoPurge();

  const [serviceCount, galleryCount, inquiryCount, followUpCount, filteredCount, overRetentionCount, honeypot, lastPurge] = await Promise.all([
    prisma.service.count(),
    prisma.galleryImage.count(),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { emailStatus: { in: [...EMAIL_ISSUE_STATUSES] } } }),
    prisma.inquiry.count({ where }),
    prisma.inquiry.count({ where: { createdAt: { lt: retentionCutoff } } }),
    prisma.siteCounter.findUnique({ where: { key: "honeypot" }, select: { count: true } }),
    lastAutoPurgeAt()
  ]);

  const { page, pageCount, skip, take } = inquiryPage(query.page, filteredCount);
  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take
  });

  const returnTo = listHref(filter, page).replace("#inquiries", "");
  const firstShown = filteredCount === 0 ? 0 : skip + 1;
  const lastShown = skip + inquiries.length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading level="h1"
          eyebrow="Admin"
          title="FM Media dashboard"
          copy="Review booking requests and jump into services or gallery management."
        />
        <div className="flex flex-wrap gap-3">
          <form action={logoutAdmin}>
            <button className="focus-ring rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold text-ink hover:border-clay">
              Sign Out
            </button>
          </form>
          <form action={logoutAllAdminSessions}>
            <button className="focus-ring rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold text-ink hover:border-clay">
              Sign out on all devices
            </button>
          </form>
        </div>
      </div>

      <AdminNotice error={query.error} success={query.success} count={query.count} />

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Totals">
        {[
          ["Inquiries", inquiryCount, "#inquiries"],
          ["Services", serviceCount, "/admin/services"],
          ["Gallery Images", galleryCount, "/admin/gallery"]
        ].map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)} className="focus-ring rounded-lg border border-line bg-white p-5 hover:border-clay">
            <p className="text-sm font-semibold text-ink/60">{label}</p>
            <p className="mt-2 font-serif text-4xl text-ink">{value}</p>
          </Link>
        ))}
      </section>

      {followUpCount > 0 ? (
        <p className="mt-4 rounded-md border border-clay bg-white px-4 py-3 text-sm font-medium text-clay" role="status">
          {followUpCount} {followUpCount === 1 ? "inquiry has" : "inquiries have"} no notification email.{" "}
          <Link href={listHref("email-issue")} className="focus-ring underline">
            Show them
          </Link>
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/admin/services" className="focus-ring rounded-lg border border-line bg-white p-6 hover:border-clay">
          <h2 className="font-serif text-2xl text-ink">Manage Services</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Add, edit, publish, feature, or delete service packages.</p>
        </Link>
        <Link href="/admin/gallery" className="focus-ring rounded-lg border border-line bg-white p-6 hover:border-clay">
          <h2 className="font-serif text-2xl text-ink">Manage Gallery</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Upload images, edit portfolio metadata, and choose featured photos.</p>
        </Link>
      </section>

      <section id="inquiries" className="mt-12 scroll-mt-24" aria-labelledby="inquiries-heading">
        <h2 id="inquiries-heading" className="font-serif text-3xl">
          Inquiries
        </h2>
        <nav aria-label="Filter inquiries" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {(Object.keys(INQUIRY_FILTERS) as InquiryFilter[]).map((key) => (
              <li key={key}>
                <Link
                  href={listHref(key)}
                  aria-current={key === filter ? "page" : undefined}
                  className={`focus-ring inline-block rounded-full border px-4 py-1.5 text-sm font-semibold ${
                    key === filter ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-clay"
                  }`}
                >
                  {INQUIRY_FILTERS[key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-3 text-sm text-ink/65">
          {filteredCount === 0 ? "No inquiries here." : `Showing ${firstShown} to ${lastShown} of ${filteredCount}, newest first.`}
        </p>

        <ol className="mt-5 grid gap-4">
          {inquiries.map((inquiry) => {
            const email = emailStatus(inquiry.emailStatus);
            return (
              <li key={inquiry.id}>
                <article className="rounded-lg border border-line bg-white p-5" aria-labelledby={`inquiry-${inquiry.id}`}>
                  <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 id={`inquiry-${inquiry.id}`} className="font-serif text-xl text-ink">
                      {inquiry.name}
                    </h3>
                    <p className="text-sm text-ink/65">
                      Received <time dateTime={inquiry.createdAt.toISOString()}>{receivedFormat.format(inquiry.createdAt)}</time>
                      {" · "}
                      {inquiry.status === "CONTACTED" ? "Contacted" : "New"}
                    </p>
                  </header>
                  <p
                    className={`mt-2 inline-block rounded border px-1.5 py-0.5 text-xs font-semibold ${
                      email.followUp ? "border-clay text-clay" : "border-line text-ink/65"
                    }`}
                  >
                    {email.label}
                  </p>

                  <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Email">
                      <a href={`mailto:${inquiry.email}`} className="focus-ring underline">
                        {inquiry.email}
                      </a>
                    </Detail>
                    <Detail label="Phone">
                      <a href={`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`} className="focus-ring underline">
                        {inquiry.phone}
                      </a>
                    </Detail>
                    <Detail label="Realtor / agency">{inquiry.agencyName || "Not provided"}</Detail>
                    <Detail label="Property address">{inquiry.propertyAddress}</Detail>
                    <Detail label="Approx. sq ft">{inquiry.propertySize}</Detail>
                    <Detail label="Photo package">{inquiry.photoPackage || "No photo package selected"}</Detail>
                    <Detail label="Add-ons">{inquiry.addOns || "None"}</Detail>
                    <Detail label="Video">{inquiry.videoService || "None"}</Detail>
                    <Detail label="Free first-shoot drone photos">{inquiry.firstShootOffer ? "Claimed" : "Not claimed"}</Detail>
                    <Detail label="Preferred date">{formatStoredDate(inquiry.preferredDate)}</Detail>
                    <Detail label="Time window">{inquiry.preferredWindow}</Detail>
                    <Detail label="Exact start time">{inquiry.preferredTime === "Flexible" ? "None given" : inquiry.preferredTime}</Detail>
                  </dl>

                  <div className="mt-4 text-sm">
                    <h4 className="text-sm font-semibold text-ink/60">Message</h4>
                    <p className="mt-1 whitespace-pre-wrap break-words text-ink">{inquiry.message}</p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
                    <form action={updateInquiryContacted} className="flex items-center gap-3">
                      <input type="hidden" name="id" value={inquiry.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <label className="flex items-center gap-2 text-sm font-medium text-ink">
                        <input name="contacted" type="checkbox" defaultChecked={inquiry.status === "CONTACTED"} className="h-4 w-4 accent-clay" />
                        Contacted
                      </label>
                      <button className="focus-ring rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:border-clay">
                        Save
                      </button>
                    </form>
                    <form action={deleteInquiry} className="flex items-center gap-3">
                      <input type="hidden" name="id" value={inquiry.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <label className="flex items-center gap-2 text-xs font-medium text-ink/70">
                        <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
                        Confirm delete
                      </label>
                      <button className="focus-ring text-sm font-semibold text-clay" aria-label={`Delete inquiry from ${inquiry.name}`}>
                        Delete
                      </button>
                    </form>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>

        {pageCount > 1 ? (
          <nav aria-label="Inquiry pages" className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            {page > 1 ? (
              <Link href={listHref(filter, page - 1)} className="focus-ring rounded-full border border-line bg-white px-4 py-1.5 font-semibold text-ink hover:border-clay">
                Newer
              </Link>
            ) : null}
            <span className="text-ink/65" aria-current="page">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={listHref(filter, page + 1)} className="focus-ring rounded-full border border-line bg-white px-4 py-1.5 font-semibold text-ink hover:border-clay">
                Older
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <section id="retention" className="mt-12 scroll-mt-24 rounded-lg border border-line bg-white p-5" aria-labelledby="retention-heading">
        <h2 id="retention-heading" className="font-serif text-2xl">
          Keeping inquiries
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
          Booking inquiries are kept for {retentionMonths} months (the <code>INQUIRY_RETENTION_MONTHS</code> setting; 24 by default).
          {" "}
          {overRetentionCount === 0
            ? "None are older than that."
            : `${overRetentionCount} ${overRetentionCount === 1 ? "was" : "were"} received more than ${retentionMonths} months ago.`}{" "}
          Older ones are deleted automatically: the site checks at most once an hour, when a booking comes in or when this
          page loads{lastPurge ? ` (last check ${receivedFormat.format(lastPurge)}, Chicago time)` : ""}. You can also delete them
          right away below. Copies in your email inbox aren&apos;t touched and have to be deleted there.
        </p>
        <form action={purgeOldInquiries} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm font-medium text-ink">
            Delete inquiries received more than
            <span className="flex items-center gap-2">
              <input
                name="months"
                type="number"
                min={1}
                max={120}
                step={1}
                required
                defaultValue={retentionMonths}
                className="w-24 rounded-md border border-line px-3 py-2 font-normal"
              />
              months ago
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
            <input name="confirmDelete" type="checkbox" required className="h-4 w-4 accent-clay" />
            I understand this permanently deletes them
          </label>
          <button className="focus-ring rounded-full border border-clay px-5 py-2 text-sm font-semibold text-clay">Delete old inquiries</button>
        </form>
      </section>

      <p className="mt-8 text-sm text-ink/60">
        Spam caught by the booking form trap: {honeypot?.count ?? 0}. These are not saved or emailed.
      </p>
    </main>
  );
}
