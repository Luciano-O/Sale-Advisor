import type { MobileOffer } from "./types";

// Mirrors OFFER_TTL_HOURS on the server: the app decides on its own while offline.
const OFFER_TTL_MS = 72 * 3_600_000;

export type OfferState = "valid" | "expired";

export function offerState(
  offer: Pick<MobileOffer, "status" | "lastSeenAt">,
  now: Date
): OfferState {
  if (offer.status === "expired") return "expired";
  return now.getTime() - new Date(offer.lastSeenAt).getTime() > OFFER_TTL_MS ? "expired" : "valid";
}

/** Found after the last visit. On a first visit nothing is marked, or everything would be. */
export function isNewOffer(
  offer: Pick<MobileOffer, "firstSeenAt">,
  lastViewedAt: string | null
): boolean {
  if (lastViewedAt === null) return false;
  return new Date(offer.firstSeenAt).getTime() > new Date(lastViewedAt).getTime();
}
