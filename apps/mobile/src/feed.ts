import type { MobileOffer } from "./types";

const PAGE_SIZE = 20;

export function offersPath(cursor: string | null): string {
  return `/v1/offers?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
}

/** An offer can reappear on a later page when its label changes between requests. */
export function appendOfferPage(current: MobileOffer[], page: MobileOffer[]): MobileOffer[] {
  const listed = new Set(current.map(({ id }) => id));
  return [...current, ...page.filter(({ id }) => !listed.has(id))];
}
