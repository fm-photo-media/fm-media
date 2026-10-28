import type { Metadata } from "next";
import type { Service } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createService, deleteService, updateService } from "@/app/actions";
import { AdminNotice, Checkbox, ConfirmDelete, SelectField, TextArea, TextInput } from "@/app/admin/admin-fields";
import { AdminShell } from "@/app/admin/admin-shell";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { countLabel, servicePreview, servicesSummary } from "@/lib/admin-view";
import { displayPrice } from "@/lib/price-menu";
import { prisma } from "@/lib/prisma";
import { serviceGroups } from "@/lib/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services and prices",
  robots: { index: false, follow: false }
};

// Batch 5b (design.md "Services and prices"): one panel per group; Edit opens that row
// inline on a tint (only one editor is on the page at a time, so every label and
// accessible name is unique: QA, 5a leftovers). "On the site it reads…" previews the
// result. Fields the public pages don't show (description, turnaround, featured, the web
// address and the group) sit behind "More fields".

const CATEGORY_OPTIONS = serviceGroups.map((group) => ({ value: group.key, label: group.title }));
const ID_RE = /^[a-z0-9]{8,40}$/i;

function ServiceFields({ service, idPrefix, isNew }: { service?: Service; idPrefix: string; isNew: boolean }) {
  const categoryOptions =
    service && !CATEGORY_OPTIONS.some((option) => option.value === service.category)
      ? [...CATEGORY_OPTIONS, { value: service.category, label: service.category }]
      : CATEGORY_OPTIONS;
  const more = (
    <>
      <TextInput
        name="slug"
        label="Web address name"
        idPrefix={idPrefix}
        defaultValue={service?.slug}
        maxLength={80}
        hint="Lower-case words joined by hyphens, for example “drone-photos”."
      />
      <SelectField name="category" label="Group" idPrefix={idPrefix} defaultValue={service?.category ?? "PHOTO"} options={categoryOptions} />
      <TextArea
        name="description"
        label="Description"
        idPrefix={idPrefix}
        defaultValue={service?.description}
        rows={3}
        maxLength={4000}
        className="ad-span-2"
        hint="20 characters or more. Not shown on the site today."
      />
      <TextInput name="turnaround" label="Turnaround" idPrefix={idPrefix} defaultValue={service?.turnaround} maxLength={160} />
      <div className="ad-field">
        <span className="ad-field__label">Highlight</span>
        <Checkbox name="featured" label="Featured" idPrefix={idPrefix} defaultChecked={service?.featured} />
      </div>
    </>
  );

  return (
    <>
      <TextInput name="title" label="Name" idPrefix={idPrefix} defaultValue={service?.title} maxLength={120} />
      <TextInput
        name="priceLabel"
        label="Price on the site"
        idPrefix={idPrefix}
        defaultValue={service?.priceLabel ?? ""}
        required={false}
        maxLength={60}
        hint="As written on the site, for example “$250-$400+”. Leave blank to show the starting price."
      />
      <TextInput
        name="startingAt"
        label="Starting at, in dollars (for the booking total)"
        idPrefix={idPrefix}
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={service?.startingAt}
      />
      <TextInput name="squareFeet" label="Home size" idPrefix={idPrefix} defaultValue={service?.squareFeet ?? ""} required={false} maxLength={80} />
      <TextInput name="deliverable" label="What's included" idPrefix={idPrefix} defaultValue={service?.deliverable} maxLength={300} />
      <TextInput name="bestUse" label="Best for" idPrefix={idPrefix} defaultValue={service?.bestUse ?? ""} required={false} maxLength={160} />
      <TextInput
        name="summary"
        label="One-line summary"
        idPrefix={idPrefix}
        defaultValue={service?.summary}
        maxLength={600}
        className="ad-span-2"
        hint="10 characters or more."
      />
      <div className="ad-field">
        <span className="ad-field__label">On the site</span>
        <Checkbox name="published" label="Published" idPrefix={idPrefix} defaultChecked={service ? service.published : true} />
      </div>
      <TextInput
        name="sortOrder"
        label="Order in its group"
        idPrefix={idPrefix}
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={service?.sortOrder ?? 0}
        hint="Lower numbers show first."
      />
      {service ? (
        <p className="ad-edit__preview">
          <small>On the site it reads</small>
          <span className="tnum">{servicePreview(service)}</span>
        </p>
      ) : null}
      {isNew ? (
        more
      ) : (
        <details className="ad-more">
          <summary>More fields</summary>
          <div className="ad-more__grid">{more}</div>
        </details>
      )}
    </>
  );
}

export default async function AdminServicesPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; edit?: string; add?: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const query = await searchParams;
  const services = await prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] });
  const adding = query.add === "1";
  const editing = !adding && query.edit && ID_RE.test(query.edit) ? query.edit : null;
  const known = new Set<string>(serviceGroups.map((group) => group.key));
  const groups = [
    ...serviceGroups.map((group) => ({ key: group.key as string, title: group.title as string, rows: services.filter((s) => s.category === group.key) })),
    { key: "OTHER", title: "Other", rows: services.filter((s) => !known.has(s.category)) }
  ].filter((group) => group.rows.length > 0);

  return (
    <AdminShell current="services" crumb={<b>Services and prices</b>}>
      <div className="ad-title">
        <div>
          <h1>Services and prices</h1>
          <p className="tnum">
            <b>{servicesSummary({ total: services.length, published: services.filter((s) => s.published).length })}</b> Changes show on the site,
            the price list and the booking form at once.
          </p>
        </div>
        {adding ? null : (
          <Link className="ad-btn ad-btn--primary" href="/admin/services?add=1#add">
            Add a service
          </Link>
        )}
      </div>

      <AdminNotice error={query.error} success={query.success} />

      {adding ? (
        <section className="ad-panel" id="add" aria-labelledby="add-heading">
          <div className="ad-panel__head">
            <h2 id="add-heading">Add a service</h2>
            <p>Price on the site, home size and best for can be left blank.</p>
          </div>
          <form action={createService} className="ad-edit" aria-labelledby="add-heading">
            <ServiceFields idPrefix="svc-new" isNew />
            <div className="ad-edit__acts">
              <Link className="ad-btn" href="/admin/services">
                Cancel
              </Link>
              <button className="ad-btn ad-btn--primary">Add service</button>
            </div>
          </form>
        </section>
      ) : null}

      {services.length === 0 ? (
        <section className="ad-panel">
          <p className="ad-empty">No services yet. Add the first one with “Add a service”.</p>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="ad-panel" aria-labelledby={`group-${group.key}`}>
          <div className="ad-panel__head">
            <h2 id={`group-${group.key}`}>{group.title}</h2>
            <p className="tnum">
              {countLabel(group.rows.length, "service")}, {group.rows.filter((s) => s.published).length} on the site
            </p>
          </div>
          <table className="ad-rows ad-rows--list ad-rows--services">
            {/* DES-42: one set of column widths for every group, so each column has one edge. */}
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Home size</th>
                <th scope="col">Included</th>
                <th scope="col" className="ad-num">
                  Price
                </th>
                <th scope="col" className="ad-num">
                  Starting at
                </th>
                <th scope="col">On the site</th>
                <th scope="col" className="ad-num">
                  <span className="ad-vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((service) => {
                const open = service.id === editing;
                return [
                  <tr key={service.id} id={`svc-${service.id}`} className={open ? "is-open" : undefined}>
                    <td>
                      <b>{service.title}</b>
                      <span className="ad-sub">{service.slug}</span>
                    </td>
                    <td data-l="Home size">{service.squareFeet ? service.squareFeet : <span className="ad-dash">—</span>}</td>
                    <td data-l="Included">{service.deliverable}</td>
                    <td className="ad-num" data-l="Price">
                      {displayPrice(service)}
                    </td>
                    <td className="ad-num" data-l="Starting at">
                      {/* DES-47: a discount has no starting price; a printed $0 would claim one. */}
                      {service.category === "DISCOUNT" ? <span className="ad-dash">—</span> : `$${service.startingAt}`}
                    </td>
                    <td>
                      {service.published ? <span className="ad-tag ad-tag--pos">Published</span> : <span className="ad-tag ad-tag--off">Hidden</span>}
                    </td>
                    <td className="ad-num">
                      <div className="ad-actions">
                        <Link
                          className="ad-btn ad-btn--text"
                          href={open ? `/admin/services#svc-${service.id}` : `/admin/services?edit=${service.id}#svc-${service.id}`}
                          aria-expanded={open}
                          aria-label={`${open ? "Close" : "Edit"} ${service.title}`}
                        >
                          {open ? "Close" : "Edit"}
                        </Link>
                      </div>
                    </td>
                    {/* DES-40: the phone layout (<=640px): name and price, then one grey line. */}
                    <td className="ad-phone" colSpan={7}>
                      <div className="ad-phone__l1">
                        <b>{service.title}</b>
                        <span className="ad-phone__end">
                          <span className="tnum">{displayPrice(service)}</span>
                          <Link
                            className="ad-btn ad-btn--text"
                            href={open ? `/admin/services#svc-${service.id}` : `/admin/services?edit=${service.id}#svc-${service.id}`}
                            aria-expanded={open}
                            aria-label={`${open ? "Close" : "Edit"} ${service.title}`}
                          >
                            {open ? "Close" : "Edit"}
                          </Link>
                        </span>
                      </div>
                      <p className="ad-phone__l2">
                        {[service.squareFeet, service.deliverable, service.published ? "Published" : "Hidden"].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                  </tr>,
                  open ? (
                    <tr key={`${service.id}-edit`} className="ad-msg">
                      <td colSpan={7} style={{ padding: 0 }}>
                        <form action={updateService} className="ad-edit" aria-label={`Edit ${service.title}`}>
                          <input type="hidden" name="id" value={service.id} />
                          <ServiceFields service={service} idPrefix={`svc-${service.id}`} isNew={false} />
                          <div className="ad-edit__acts">
                            <span />
                            <span>
                              <Link className="ad-btn" href={`/admin/services#svc-${service.id}`}>
                                Cancel
                              </Link>
                              <button className="ad-btn ad-btn--primary">Save changes</button>
                            </span>
                          </div>
                        </form>
                        <div className="ad-edit" style={{ paddingTop: 0 }}>
                          <div className="ad-span-2">
                            <ConfirmDelete
                              summary="Delete this service"
                              question={`Delete “${service.title}”? It comes off the site and the booking form. Past requests keep their text.`}
                              action={deleteService}
                              confirmLabel="Delete service"
                            >
                              <input type="hidden" name="id" value={service.id} />
                            </ConfirmDelete>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null
                ];
              })}
            </tbody>
          </table>
        </section>
      ))}
    </AdminShell>
  );
}
