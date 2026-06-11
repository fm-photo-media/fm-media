import type { Service } from "@prisma/client";

export function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="rounded-lg border border-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-serif text-2xl text-ink">{service.title}</h3>
        <p className="shrink-0 rounded-full bg-mist px-3 py-1 text-sm font-semibold text-clay">
          From ${service.startingAt}
        </p>
      </div>
      <p className="mt-4 leading-7 text-ink/70">{service.summary}</p>
      <div className="mt-6 grid gap-3 border-t border-line pt-5 text-sm text-ink/70">
        <p>
          <span className="font-semibold text-ink">Deliverables:</span> {service.deliverable}
        </p>
        <p>
          <span className="font-semibold text-ink">Turnaround:</span> {service.turnaround}
        </p>
      </div>
    </article>
  );
}
