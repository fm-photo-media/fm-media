import type { Metadata } from "next";
import type { Inquiry, Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteInquiry, purgeOldInquiries, updateInquiryContacted } from "@/app/actions";
import { AdminNotice, ConfirmDelete } from "@/app/admin/admin-fields";
import { AdminShell } from "@/app/admin/admin-shell";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  callBackSummary,
  clockLabel,
  countLabel,
  pagerLabel,
  receivedLabel,
  requestsLead,
  shootDayLabel,
  shootDays,
  sqftLabel,
  telHref
} from "@/lib/admin-view";
import { lastAutoPurgeAt, runAutoPurge } from "@/lib/auto-purge-db";
import { BOOKING_TIME_ZONE, storedDateFromInput } from "@/lib/booking-time";
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
  title: "Requests",
  robots: { index: false, follow: false }
};

// Batch 5b (design.md "Requests", note 5): the screen answers "Who's waiting for a reply, and
// did any notification fail?" The finding sits under the h1; new requests whose email never
// reached the owner come first on page 1, each with a tel: link; then the 14-day shoot strip,
// the New / Contacted / All tabs and the table (two-line rows at 1000px and below).

type SearchParams = { error?: string; success?: string; count?: string; page?: string; status?: string; req?: string };

const ISSUE = { in: [...EMAIL_ISSUE_STATUSES] };
const NEEDS_CALL_BACK: Prisma.InquiryWhereInput = { status: "NEW", emailStatus: ISSUE };

const EMAIL_NOTES: Record<string, { tag?: string; note: string }> = {
  SENT: { note: "" },
  FAILED: { tag: "Email failed", note: "You never got this one by email" },
  SKIPPED_CAP: { tag: "Email not sent", note: "Over the day's email limit, so you never got it by email" },
  SKIPPED: { note: "Email not set up (local only)" },
  PENDING: { note: "Email pending" },
  UNKNOWN: { note: "Email status unknown (booked before Oct 2026)" }
};

const TAB_ORDER: InquiryFilter[] = ["NEW", "CONTACTED", "all", "email-issue"];

const lastCheckFormat = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });

function filterWhere(filter: InquiryFilter): Prisma.InquiryWhereInput {
  if (filter === "NEW" || filter === "CONTACTED") return { status: filter };
  if (filter === "email-issue") return { emailStatus: ISSUE };
  return {};
}

function listHref(filter: InquiryFilter, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin${query ? `?${query}` : ""}`;
}

const isNone = (value: string | null | undefined) => !value || /^(none|not provided|not selected)$/i.test(value.trim());

function ContactedForm({ inquiry, returnTo }: { inquiry: Inquiry; returnTo: string }) {
  const contacted = inquiry.status === "CONTACTED";
  return (
    <form action={updateInquiryContacted} className="ad-inline-form">
      <input type="hidden" name="id" value={inquiry.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {contacted ? null : <input type="hidden" name="contacted" value="on" />}
      <button
        className="ad-btn ad-btn--text"
        aria-label={contacted ? `Mark the request from ${inquiry.name} as new` : `Mark ${inquiry.name} as contacted`}
      >
        {contacted ? "Mark as new" : "Mark contacted"}
      </button>
    </form>
  );
}

function DeleteRequest({ inquiry, returnTo }: { inquiry: Inquiry; returnTo: string }) {
  return (
    <ConfirmDelete
      summary="Delete"
      summaryLabel={`Delete the request from ${inquiry.name}`}
      question={`Delete the request from ${inquiry.name}? This can't be undone.`}
      action={deleteInquiry}
      confirmLabel="Delete request"
      confirmAriaLabel={`Yes, delete the request from ${inquiry.name}`}
    >
      <input type="hidden" name="id" value={inquiry.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </ConfirmDelete>
  );
}

function RequestRows({ inquiry, returnTo, now, single }: { inquiry: Inquiry; returnTo: string; now: Date; single: boolean }) {
  const received = receivedLabel(inquiry.createdAt, now);
  const email = EMAIL_NOTES[inquiry.emailStatus] ?? { note: `Email: ${inquiry.emailStatus}` };
  const services = [inquiry.addOns, isNone(inquiry.videoService) ? "" : inquiry.videoService].filter((part) => part && part.trim()).join(" · ");
  const contacted = inquiry.status === "CONTACTED";
  const clock = clockLabel(inquiry.preferredTime);
  const time = clock ? `${clock}, ` : "";
  const sqft = sqftLabel(inquiry.propertySize);
  const pkg = isNone(inquiry.photoPackage) ? "No photo package" : inquiry.photoPackage;
  // DES-45: one status mark per row. A failed email carries the tag; otherwise the state.
  const state = email.tag ? null : contacted ? "Contacted" : "New, not contacted yet";
  // DES-40: the phone's continuation line (13px grey): everything that isn't on lines 1 and 3.
  const phoneDetail = [
    pkg,
    services,
    inquiry.propertyAddress,
    inquiry.agencyName,
    `received ${received.day === "Today" || received.day === "Yesterday" ? received.day.toLowerCase() : received.day} ${received.time}`,
    sqft,
    `${clock ? `${clock}, ` : ""}${inquiry.preferredWindow.toLowerCase()}`,
    inquiry.firstShootOffer ? "first-shoot drone claimed" : "",
    contacted ? "contacted" : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <tr id={`r-${inquiry.id}`}>
        <td className="ad-received tnum" data-l="Received">
          <time dateTime={inquiry.createdAt.toISOString()}>
            {received.day}
            <span className="ad-sub">{received.time}</span>
          </time>
        </td>
        <td className="ad-agent">
          <b>{inquiry.name}</b>
          <span className="ad-sub">{inquiry.agencyName ? inquiry.agencyName : <span className="ad-dash">No agency</span>}</span>
          <span className="ad-contact">
            <a href={telHref(inquiry.phone)} aria-label={`Call ${inquiry.name} at ${inquiry.phone}`}>
              {inquiry.phone}
            </a>
            <a href={`mailto:${inquiry.email}`} aria-label={`Email ${inquiry.name} at ${inquiry.email}`}>
              Email
            </a>
          </span>
        </td>
        <td>
          {inquiry.propertyAddress}
          <span className="ad-sub tnum">{sqft ?? <span className="ad-dash">—</span>}</span>
        </td>
        <td>
          <b>{pkg}</b>
          <span className="ad-sub">{services || <span className="ad-dash">No add-ons</span>}</span>
          {inquiry.firstShootOffer ? <span className="ad-tag ad-tag--offer">First-shoot drone claimed</span> : null}
        </td>
        <td className="tnum" data-l="Shoot">
          {shootDayLabel(inquiry.preferredDate, now)}
          <span className="ad-sub">
            {time}
            {inquiry.preferredWindow}
          </span>
        </td>
        <td>
          {email.tag ? <span className="ad-tag ad-tag--neg">{email.tag}</span> : null}
          {email.note ? <span className="ad-sub">{email.note}</span> : null}
          {state ? <span className="ad-sub">{state}</span> : null}
          <ContactedForm inquiry={inquiry} returnTo={returnTo} />
        </td>
        <td className="ad-num">
          <div className="ad-actions">
            <DeleteRequest inquiry={inquiry} returnTo={returnTo} />
          </div>
        </td>
        {/* DES-40: the phone layout (<=640px) is this one cell, three lines; the cells above hide. */}
        <td className="ad-phone" colSpan={7}>
          <div className="ad-phone__l1">
            <span>
              {/* The name opens this request on its own, with the full message. */}
              <Link className="ad-phone__name" href={`/admin?req=${inquiry.id}#r-${inquiry.id}`}>
                {inquiry.name}
              </Link>
              {email.tag ? <span className="ad-tag ad-tag--neg">{email.tag}</span> : null}
            </span>
            <span className="tnum">{shootDayLabel(inquiry.preferredDate, now)}</span>
          </div>
          <p className="ad-phone__l2 tnum">{phoneDetail}</p>
          <div className="ad-phone__l3">
            <a className="tnum" href={telHref(inquiry.phone)} aria-label={`Call ${inquiry.name} at ${inquiry.phone}`}>
              {inquiry.phone}
            </a>
            <a href={`mailto:${inquiry.email}`} aria-label={`Email ${inquiry.name} at ${inquiry.email}`}>
              Email
            </a>
            <ContactedForm inquiry={inquiry} returnTo={returnTo} />
            <DeleteRequest inquiry={inquiry} returnTo={returnTo} />
          </div>
        </td>
      </tr>
      <tr className="ad-msg">
        <td aria-hidden="true" />
        {/* DES-40: on a phone the message is clamped to two lines; the single-request view shows it all. */}
        <td colSpan={6} className={single ? undefined : "ad-msg__cell--clamp"}>
          <span className="ad-msg__label">Message: </span>
          {inquiry.message.trim() ? (
            <span className="ad-msg__text">{inquiry.message}</span>
          ) : (
            <span className="ad-dash">None</span>
          )}
        </td>
      </tr>
    </>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const query = await searchParams;
  const single = query.req && /^[a-z0-9]{8,40}$/i.test(query.req) ? query.req : null;
  const filter = inquiryFilterFrom(query.status);
  const where: Prisma.InquiryWhereInput = single ? { id: single } : filterWhere(filter);
  const retentionMonths = retentionMonthsFrom(process.env);
  const now = new Date();
  const retentionCutoff = monthsBefore(now, retentionMonths);
  const days = shootDays(now, 14);
  const stripFrom = storedDateFromInput(days[0].iso);
  const stripTo = new Date(storedDateFromInput(days[days.length - 1].iso).getTime() + 86400000);

  // LEG-1 / Ship condition A1: delete inquiries past the retention period first, so the
  // counts below are current. At most about once an hour; never throws (auto-purge.ts).
  await runAutoPurge();

  const [total, newCount, contactedCount, issueCount, callBacks, filteredCount, pinnedCount, overRetentionCount, honeypot, lastPurge, stripRows] =
    await Promise.all([
      prisma.inquiry.count(),
      prisma.inquiry.count({ where: { status: "NEW" } }),
      prisma.inquiry.count({ where: { status: "CONTACTED" } }),
      prisma.inquiry.count({ where: { emailStatus: ISSUE } }),
      prisma.inquiry.findMany({ where: NEEDS_CALL_BACK, orderBy: { createdAt: "desc" }, select: { name: true, phone: true }, take: 50 }),
      prisma.inquiry.count({ where }),
      prisma.inquiry.count({ where: { AND: [where, NEEDS_CALL_BACK] } }),
      prisma.inquiry.count({ where: { createdAt: { lt: retentionCutoff } } }),
      prisma.siteCounter.findUnique({ where: { key: "honeypot" }, select: { count: true } }),
      lastAutoPurgeAt(),
      prisma.inquiry.findMany({
        where: { preferredDate: { gte: stripFrom, lt: stripTo } },
        orderBy: [{ preferredDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, status: true, preferredDate: true, preferredTime: true, preferredWindow: true },
        take: 200
      })
    ]);

  // Page 1 starts with the new requests nobody was notified about; the rest page as before.
  const restWhere: Prisma.InquiryWhereInput = { AND: [where, { NOT: NEEDS_CALL_BACK }] };
  const restCount = filteredCount - pinnedCount;
  const { page, pageCount, skip, take } = inquiryPage(query.page, restCount);
  const [pinned, inquiries] = await Promise.all([
    page === 1 && pinnedCount > 0
      ? prisma.inquiry.findMany({ where: { AND: [where, NEEDS_CALL_BACK] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 })
      : Promise.resolve([] as Inquiry[]),
    prisma.inquiry.findMany({ where: restWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take })
  ]);

  const returnTo = single ? `/admin?req=${single}` : listHref(filter, page);
  const callBack = callBackSummary(callBacks);
  const tabCounts: Record<InquiryFilter, number> = { NEW: newCount, CONTACTED: contactedCount, all: total, "email-issue": issueCount };
  const strip = days.map((day) => ({ ...day, rows: stripRows.filter((row) => row.preferredDate.toISOString().slice(0, 10) === day.iso) }));

  return (
    <AdminShell current="requests" crumb={<b>Requests</b>}>
      <div className="ad-title">
        <div>
          <h1>Requests</h1>
          <p>
            <b className="tnum">{requestsLead({ total, newCount })}</b>
            {callBack ? (
              <>
                {" "}
                <span className="ad-neg">{callBack.label}</span>{" "}
                {callBack.one ? (
                  <>
                    call {callBack.one.name} back at{" "}
                    <a className="tnum" href={telHref(callBack.one.phone)}>
                      {callBack.one.phone}
                    </a>
                    .
                  </>
                ) : (
                  <>call them back first. They&apos;re at the top of the list.</>
                )}
              </>
            ) : null}
          </p>
        </div>
      </div>

      <AdminNotice error={query.error} success={query.success} count={query.count} />

      <section className="ad-panel" aria-labelledby="days-heading">
        <div className="ad-panel__head">
          <h2 id="days-heading">Requested shoot days</h2>
          <p className="tnum">
            Next 14 days · {stripRows.length} of {countLabel(total, "request")}
          </p>
        </div>
        <ol className="ad-days">
          {strip.map((day) => (
            <li key={day.iso} className={`ad-day${day.weekend ? " ad-day--wk" : ""}${day.today ? " ad-day--today" : ""}`}>
              <span className="ad-day__d">
                {day.weekday} <b className="tnum">{day.day}</b>
                {day.today ? <span className="ad-vh"> (today)</span> : null}
              </span>
              {day.rows.map((row) => (
                <Link
                  key={row.id}
                  className={`ad-mark ad-mark--${row.status === "NEW" ? "new" : "done"}`}
                  href={`/admin?req=${row.id}#r-${row.id}`}
                  aria-label={`${row.name}, ${row.status === "NEW" ? "new" : "contacted"}, ${day.weekday} ${day.day}`}
                >
                  {row.name.split(" ")[0]}
                  <span className="tnum">{clockLabel(row.preferredTime) || row.preferredWindow}</span>
                </Link>
              ))}
            </li>
          ))}
        </ol>
      </section>

      {single ? (
        <p className="ad-notice" role="status">
          Showing one request.{" "}
          <Link className="ad-link" href="/admin">
            Show all requests
          </Link>
        </p>
      ) : (
        <nav className="ad-tabs" aria-label="Filter requests">
          {TAB_ORDER.filter((key) => key !== "email-issue" || issueCount > 0 || filter === "email-issue").map((key) => (
            <Link key={key} href={listHref(key)} aria-current={key === filter ? "page" : undefined}>
              {INQUIRY_FILTERS[key]}
              <span className="tnum">{tabCounts[key]}</span>
            </Link>
          ))}
        </nav>
      )}

      <section id="requests" className="ad-panel ad-list" aria-label="Requests, newest first">
        {filteredCount === 0 ? (
          <p className="ad-empty">
            {total === 0 ? "When someone sends the booking form, their request shows here with a call link." : "No requests here."}
          </p>
        ) : (
          <table className="ad-rows ad-rows--requests">
            <thead>
              <tr>
                <th scope="col">Received</th>
                <th scope="col">Agent</th>
                <th scope="col">Property</th>
                <th scope="col">Services</th>
                <th scope="col">Preferred</th>
                <th scope="col">Status</th>
                <th scope="col" className="ad-num">
                  <span className="ad-vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pinned.length > 0 ? (
                <tr className="ad-group">
                  <td colSpan={7}>Call back first: {countLabel(pinned.length, "new request")} whose email never reached you</td>
                </tr>
              ) : null}
              {pinned.map((inquiry) => (
                <RequestRows key={inquiry.id} inquiry={inquiry} returnTo={returnTo} now={now} single={Boolean(single)} />
              ))}
              {inquiries.map((inquiry) => (
                <RequestRows key={inquiry.id} inquiry={inquiry} returnTo={returnTo} now={now} single={Boolean(single)} />
              ))}
            </tbody>
          </table>
        )}
        {filteredCount > 0 ? (
          <nav className="ad-pager" aria-label="Request pages">
            {/* DES-46: the pinned call-back rows count in the range, so the total matches the finding. */}
            <span className="tnum">{pagerLabel({ pinned: pinnedCount, skip, shown: inquiries.length, total: filteredCount })}</span>
            {pageCount > 1 ? (
              <div>
                {page > 1 ? (
                  <Link className="ad-btn" href={listHref(filter, page - 1)}>
                    Newer
                  </Link>
                ) : null}
                <span className="ad-vh" aria-current="page">
                  Page {page} of {pageCount}
                </span>
                {page < pageCount ? (
                  <Link className="ad-btn" href={listHref(filter, page + 1)}>
                    Older
                  </Link>
                ) : null}
              </div>
            ) : null}
          </nav>
        ) : null}
      </section>

      <section id="retention" className="ad-panel" aria-labelledby="retention-heading">
        <div className="ad-panel__head">
          <h2 id="retention-heading">Old requests</h2>
          <p className="tnum">
            {overRetentionCount === 0 ? `None older than ${retentionMonths} months` : `${overRetentionCount} older than ${retentionMonths} months`}
          </p>
        </div>
        <div className="ad-panel__body">
          {/* Batch 5b note 6: the setting's name stays in the README, not on this screen. */}
          <p>
            Requests are kept for {retentionMonths} months, then deleted automatically. The site checks at most once an hour, when a booking
            comes in or when this page loads
            {lastPurge ? (
              <>
                {" "}
                (last check <time dateTime={lastPurge.toISOString()}>{lastCheckFormat.format(lastPurge)}</time>, Chicago time)
              </>
            ) : null}
            . Copies in your email inbox aren&apos;t touched; delete those in your inbox.
          </p>
          <form action={purgeOldInquiries} className="ad-edit ad-edit--plain" style={{ padding: "16px 0 0" }}>
            <div className="ad-field">
              <label htmlFor="purge-months">Delete requests received more than this many months ago</label>
              <input
                id="purge-months"
                name="months"
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                step={1}
                required
                defaultValue={retentionMonths}
                className="ad-input tnum"
                style={{ maxWidth: 140 }}
              />
            </div>
            <div className="ad-field">
              <span className="ad-field__label">Confirm</span>
              <label className="ad-check" htmlFor="purge-confirm">
                <input id="purge-confirm" name="confirmDelete" type="checkbox" required />
                <span>I understand this permanently deletes them</span>
              </label>
            </div>
            <div className="ad-edit__acts">
              <span />
              <button className="ad-btn ad-btn--danger">Delete old requests</button>
            </div>
          </form>
        </div>
      </section>

      <p className="ad-note tnum">Spam caught by the booking form&apos;s trap: {honeypot?.count ?? 0}. These are not saved or emailed.</p>
    </AdminShell>
  );
}
