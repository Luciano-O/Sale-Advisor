import { offerName, subcategoryName } from "./labels";
import { offerState } from "./offer-state";
import type { HiddenOfferSnapshot, MobileOffer, OfferSort } from "./types";

const PAGE_SIZE = 20;

export function offersPath(cursor: string | null, sort: OfferSort = "recent"): string {
  const sortParam = sort === "recent" ? "" : `&sort=${sort}`;
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return `/v1/offers?limit=${PAGE_SIZE}${sortParam}${cursorParam}`;
}

/** An offer can reappear on a later page when its label changes between requests. */
export function appendOfferPage(current: MobileOffer[], page: MobileOffer[]): MobileOffer[] {
  const listed = new Set(current.map(({ id }) => id));
  return [...current, ...page.filter(({ id }) => !listed.has(id))];
}

/** The same order as the API, so the cache reads the same offline and pages stay consistent. */
export function sortOffers(offers: readonly MobileOffer[], sort: OfferSort): MobileOffer[] {
  const discount = (offer: MobileOffer) =>
    offer.history.discountVsMedianPercent ?? Number.NEGATIVE_INFINITY;
  return [...offers].sort(
    (left, right) =>
      (sort === "discount" ? discount(right) - discount(left) || 0 : 0) ||
      right.firstSeenAt.localeCompare(left.firstSeenAt) ||
      right.id.localeCompare(left.id)
  );
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

/** What the Ofertas list shows: only valid offers, narrowed to a subcategory or a model. */
export function visibleOffers(
  offers: readonly MobileOffer[],
  { now, category, model }: { now: Date; category?: string; model?: string }
): MobileOffer[] {
  return offers.filter(
    (offer) =>
      offerState(offer, now) === "valid" &&
      (category === undefined || offer.product.category === category) &&
      (model === undefined || normalize(offer.product.model) === normalize(model))
  );
}

export const ALL_SUBCATEGORIES = "all";

/** One subcategory has nothing to filter, so the chips only appear from two on. */
export function subcategoryFilters(
  followedCategories: readonly string[]
): Array<{ key: string; label: string }> {
  if (followedCategories.length < 2) return [];
  return [
    { key: ALL_SUBCATEGORIES, label: "Tudo" },
    ...followedCategories.map((key) => ({ key, label: subcategoryName(key) }))
  ];
}

export function offerCountLabel(count: number, hasMore: boolean): string {
  if (hasMore) return `${count}+ ofertas`;
  return count === 1 ? "1 oferta" : `${count} ofertas`;
}

export type CachedOffer = Omit<MobileOffer, "status" | "history"> &
  Partial<Pick<MobileOffer, "status" | "history">>;

export const EMPTY_HISTORY: MobileOffer["history"] = {
  median30dInCents: null,
  lowest90dInCents: null,
  discountVsMedianPercent: null
};

/** Offers cached by an older version of the app have neither field. */
export function withOfferDefaults(offer: CachedOffer): MobileOffer {
  return { ...offer, status: offer.status ?? "active", history: offer.history ?? EMPTY_HISTORY };
}

export function hiddenOfferSnapshot(offer: MobileOffer): HiddenOfferSnapshot {
  return {
    name: offerName(offer.product),
    storeName: offer.store.name,
    priceCents: offer.effectivePriceCents
  };
}
