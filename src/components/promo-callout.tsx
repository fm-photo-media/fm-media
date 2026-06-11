import { firstShootDroneOffer } from "@/lib/promotion";

type PromoCalloutProps = {
  compact?: boolean;
};

export function PromoCallout({ compact = false }: PromoCalloutProps) {
  return (
    <aside className="rounded-lg border border-line bg-white p-4 shadow-sm" aria-label="New realtor offer">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">{firstShootDroneOffer.title}</p>
          <p className={`${compact ? "mt-1 text-sm" : "mt-2 text-base"} font-semibold text-ink`}>
            {firstShootDroneOffer.body}
          </p>
        </div>
        <p className="w-fit rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-moss">
          {firstShootDroneOffer.value}
        </p>
      </div>
    </aside>
  );
}
