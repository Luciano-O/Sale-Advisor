import type { LocalPreferences, MobileOffer, ScoreLabel } from "./types";

const LABEL_RANK: Record<ScoreLabel, number> = {
  normal: 0,
  boa: 1,
  muito_boa: 2,
  excepcional: 3
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function isOfferRelevant(
  offer: MobileOffer,
  preferences: LocalPreferences,
  hiddenIds: ReadonlySet<string>
): boolean {
  if (hiddenIds.has(offer.id) || hiddenIds.has(offer.productId)) return false;
  if (
    preferences.followedCategories.length > 0 &&
    !preferences.followedCategories.some(
      (category) => normalize(category) === normalize(offer.product.category)
    )
  )
    return false;
  if (
    preferences.followedModels.length > 0 &&
    !preferences.followedModels.some((model) => normalize(model) === normalize(offer.product.model))
  )
    return false;
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
  return LABEL_RANK[offer.label] >= LABEL_RANK[preferences.minimumLabel];
}

export function filterOffers(
  offers: MobileOffer[],
  preferences: LocalPreferences,
  hiddenIds: ReadonlySet<string>
): MobileOffer[] {
  return offers
    .filter((offer) => isOfferRelevant(offer, preferences, hiddenIds))
    .sort(
      (left, right) =>
        LABEL_RANK[right.label] - LABEL_RANK[left.label] ||
        right.qualityScore - left.qualityScore ||
        right.firstSeenAt.localeCompare(left.firstSeenAt)
    );
}
