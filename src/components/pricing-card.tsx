import type { Service } from "@prisma/client";
import { servicePrice } from "@/lib/services";

export function PricingCard({ service }: { service: Service }) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
      {service.bestUse ? (
        <p className="w-fit rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-clay">
          {service.bestUse}
        </p>
      ) : null}
      <h3 className="mt-4 font-serif text-2xl text-ink">{service.title}</h3>
      <p className="mt-3 text-3xl font-semibold text-clay sm:text-4xl">{servicePrice(service)}</p>
      {service.squareFeet ? <p className="mt-2 text-sm font-semibold text-ink/70">{service.squareFeet}</p> : null}
      <p className="mt-4 text-sm leading-6 text-ink/70">{service.summary}</p>
      <p className="mt-5 border-t border-line pt-5 text-sm leading-6 text-ink/75">{service.deliverable}</p>
    </article>
  );
}
