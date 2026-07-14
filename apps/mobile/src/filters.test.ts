import { describe, expect, it } from "vitest";

import { filterOffers, isOfferRelevant } from "./filters";
import type { LocalPreferences, MobileOffer } from "./types";

const baseOffer: MobileOffer = {
  id: "offer-1",
  productId: "product-1",
  product: { category: "GPU", vendor: "NVIDIA", model: "RTX 4060", vramGb: 8 },
  store: { name: "Loja Boa", domain: "boa.example" },
  effectivePriceCents: 189900,
  label: "muito_boa",
  qualityScore: 82,
  scoreSummary: "10% abaixo da mediana",
  mentionCount: 2,
  firstSeenAt: "2026-07-14T12:00:00.000Z",
  lastSeenAt: "2026-07-14T12:00:00.000Z",
  url: "https://boa.example/gpu"
};

const preferences: LocalPreferences = {
  followedCategories: ["GPU"],
  followedModels: ["RTX 4060"],
  blockedBrands: [],
  blockedStores: [],
  minimumLabel: "boa"
};

describe("local offer filters", () => {
  it("keeps only offers matching local intent and the minimum label", () => {
    expect(isOfferRelevant(baseOffer, preferences, new Set())).toBe(true);
    expect(isOfferRelevant({ ...baseOffer, label: "normal" }, preferences, new Set())).toBe(false);
    expect(
      isOfferRelevant(
        { ...baseOffer, product: { ...baseOffer.product, model: "RTX 4070" } },
        preferences,
        new Set()
      )
    ).toBe(false);
  });

  it("honors blocked brands, stores and hidden offer/product IDs", () => {
    expect(
      isOfferRelevant(baseOffer, { ...preferences, blockedBrands: ["NVIDIA"] }, new Set())
    ).toBe(false);
    expect(
      isOfferRelevant(baseOffer, { ...preferences, blockedStores: ["boa.example"] }, new Set())
    ).toBe(false);
    expect(isOfferRelevant(baseOffer, preferences, new Set(["offer-1"]))).toBe(false);
    expect(isOfferRelevant(baseOffer, preferences, new Set(["product-1"]))).toBe(false);
  });

  it("sorts relevant offers by label, quality and recency", () => {
    const exceptional = {
      ...baseOffer,
      id: "offer-2",
      label: "excepcional" as const,
      qualityScore: 70
    };
    const stronger = { ...baseOffer, id: "offer-3", qualityScore: 90 };
    expect(
      filterOffers([baseOffer, exceptional, stronger], preferences, new Set()).map(({ id }) => id)
    ).toEqual(["offer-2", "offer-3", "offer-1"]);
  });
});
