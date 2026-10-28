import { firstShootDroneOffer } from "@/lib/promotion";

// DES-10: the offer appears once per page (Home and Contact only), as plain text.
export function PromoCallout() {
  return (
    <div className="max-w-xl">
      <p className="text-base font-semibold text-ink">{firstShootDroneOffer.body}</p>
      <p className="mt-1 text-sm leading-6 text-ink/70">{firstShootDroneOffer.terms}</p>
    </div>
  );
}
