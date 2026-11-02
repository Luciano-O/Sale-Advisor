import { sortOffers } from "./feed";
import type { LocalPreferences, MobileOffer, OfferSort, ScoreLabel } from "./types";

const LABEL_RANK: Record<ScoreLabel, number> = {
  normal: 0,
  boa: 1,
  muito_boa: 2,
  excepcional: 3
};

// Decided by the system: the user chooses what to follow, never how good an offer must be.
const MINIMUM_LABEL: ScoreLabel = "boa";

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function isOfferRelevant(
  offer: MobileOffer,
  preferences: LocalPreferences,
  hiddenIds: ReadonlySet<string>
): boolean {
  if (hiddenIds.has(offer.id) || hiddenIds.has(offer.productId)) return false;
  if (LABEL_RANK[offer.label] < LABEL_RANK[MINIMUM_LABEL]) return false;
  if (
    preferences.blockedBrands.some((brand) => normalize(brand) === normalize(offer.product.vendor))
  )
    return false;
  if (
    preferences.blockedStores.some(
      (store) =>
        normalize(store) === normalize(offer.store.domain) ||
        normalize(store) === normalize(offer.store.name)
    )
  )
    return false;
  if (preferences.followAll) return true;
  const follow = preferences.subcategories[offer.product.category];
  if (!follow) return false;
  return (
    follow.mode === "inteira" ||
    follow.products.some((model) => normalize(model) === normalize(offer.product.model))
  );
}

export function filterOffers(
  offers: MobileOffer[],
  preferences: LocalPreferences,
  hiddenIds: ReadonlySet<string>,
  sort: OfferSort
): MobileOffer[] {
  return sortOffers(
    offers.filter((offer) => isOfferRelevant(offer, preferences, hiddenIds)),
    sort
  );
}
