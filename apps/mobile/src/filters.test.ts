import { describe, expect, it } from "vitest";

import { filterOffers, isOfferRelevant } from "./filters";
import { DEFAULT_PREFERENCES, type LocalPreferences, type MobileOffer } from "./types";

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
  status: "active",
  history: { median30dInCents: null, lowest90dInCents: null, discountVsMedianPercent: null },
  url: "https://boa.example/gpu"
};

const preferences: LocalPreferences = {
  ...DEFAULT_PREFERENCES,
  subcategories: { GPU: { mode: "produtos", products: ["RTX 4060"] } }
};

describe("local offer filters", () => {
  it("keeps a followed product and drops the others", () => {
    expect(isOfferRelevant(baseOffer, preferences, new Set())).toBe(true);
    expect(
      isOfferRelevant(
        { ...baseOffer, product: { ...baseOffer.product, model: "RTX 4070" } },
        preferences,
        new Set()
      )
    ).toBe(false);
  });

  it("ignores letter case when matching a product", () => {
    const lower = { GPU: { mode: "produtos" as const, products: ["rtx 4060"] } };
    expect(isOfferRelevant(baseOffer, { ...preferences, subcategories: lower }, new Set())).toBe(
      true
    );
  });

  it("keeps any product of a subcategory followed whole", () => {
    const whole = { GPU: { mode: "inteira" as const, products: ["RTX 4070"] } };
    expect(isOfferRelevant(baseOffer, { ...preferences, subcategories: whole }, new Set())).toBe(
      true
    );
  });

  it("keeps any offer when following all hardware", () => {
    expect(
      isOfferRelevant(baseOffer, { ...preferences, followAll: true, subcategories: {} }, new Set())
    ).toBe(true);
  });

  it("drops subcategories that are not followed, or have no product chosen", () => {
    expect(isOfferRelevant(baseOffer, { ...preferences, subcategories: {} }, new Set())).toBe(
      false
    );
    const none = { GPU: { mode: "produtos" as const, products: [] } };
    expect(isOfferRelevant(baseOffer, { ...preferences, subcategories: none }, new Set())).toBe(
      false
    );
  });

  it("brings only offers rated boa or better, whatever is followed", () => {
    const everything = { ...preferences, followAll: true };
    for (const label of ["boa", "muito_boa", "excepcional"] as const)
      expect(isOfferRelevant({ ...baseOffer, label }, everything, new Set())).toBe(true);
    expect(isOfferRelevant({ ...baseOffer, label: "normal" }, everything, new Set())).toBe(false);
  });

  it("blocks stores and brands even when following all hardware", () => {
    const everything = { ...preferences, followAll: true };
    expect(
      isOfferRelevant(baseOffer, { ...everything, blockedBrands: ["nvidia"] }, new Set())
    ).toBe(false);
    expect(
      isOfferRelevant(baseOffer, { ...everything, blockedStores: ["Loja Boa"] }, new Set())
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

  it("orders relevant offers by what the user chose, not by label", () => {
    const exceptional = {
      ...baseOffer,
      id: "offer-2",
      label: "excepcional" as const,
      firstSeenAt: "2026-07-13T12:00:00.000Z"
    };
    const biggerDiscount = {
      ...baseOffer,
      id: "offer-3",
      firstSeenAt: "2026-07-12T12:00:00.000Z",
      history: { ...baseOffer.history, discountVsMedianPercent: 20 }
    };
    const offers = [exceptional, biggerDiscount, baseOffer];

    expect(filterOffers(offers, preferences, new Set(), "recent").map(({ id }) => id)).toEqual([
      "offer-1",
      "offer-2",
      "offer-3"
    ]);
    expect(filterOffers(offers, preferences, new Set(), "discount")[0]?.id).toBe("offer-3");
  });
});
