import { describe, expect, it, vi } from "vitest";

import { handleOfferPush } from "./push";
import type { LocalPreferences, MobileOffer } from "./types";

const offer = {
  id: "offer-1",
  productId: "product-1",
  product: { category: "GPU", vendor: "AMD", model: "RX 7600", vramGb: 8 },
  store: { name: "Loja", domain: "store.example" },
  effectivePriceCents: 169900,
  label: "muito_boa",
  qualityScore: 85,
  scoreSummary: "Ótimo histórico",
  mentionCount: 1,
  firstSeenAt: "2026-07-14T12:00:00.000Z",
  lastSeenAt: "2026-07-14T12:00:00.000Z",
  url: "https://store.example/rx"
} satisfies MobileOffer;
const preferences: LocalPreferences = {
  followedCategories: ["GPU"],
  followedModels: [],
  blockedBrands: [],
  blockedStores: [],
  minimumLabel: "boa"
};

describe("data-only push handling", () => {
  it("fetches, filters and creates one local notification", async () => {
    const dependencies = {
      getOffer: vi.fn(async () => offer),
      getPreferences: vi.fn(async () => preferences),
      getHiddenIds: vi.fn(async () => new Set<string>()),
      wasShown: vi.fn(async () => false),
      markShown: vi.fn(async () => undefined),
      showLocalNotification: vi.fn(async () => undefined)
    };
    await expect(handleOfferPush({ offerId: "offer-1" }, dependencies)).resolves.toBe("shown");
    expect(dependencies.showLocalNotification).toHaveBeenCalledWith(offer);
    expect(dependencies.markShown).toHaveBeenCalledWith("offer-1");
  });

  const summary = {
    productId: "product-9",
    vendor: "NVIDIA",
    model: "RTX 5070",
    vramGb: 12,
    storeName: "terabyteshop.com.br",
    storeDomain: "terabyteshop.com.br",
    priceCents: 419900,
    label: "excepcional"
  };

  function summaryDependencies(overrides: Partial<LocalPreferences> = {}) {
    return {
      getOffer: vi.fn(async () => offer),
      getPreferences: vi.fn(async () => ({ ...preferences, ...overrides })),
      getHiddenIds: vi.fn(async () => new Set<string>()),
      wasShown: vi.fn(async () => false),
      markShown: vi.fn(async () => undefined),
      showLocalNotification: vi.fn(async () => undefined)
    };
  }

  it("shows an offer from the push summary without fetching it", async () => {
    const dependencies = summaryDependencies();
    await expect(
      handleOfferPush({ offerId: "offer-9", offer: JSON.stringify(summary) }, dependencies)
    ).resolves.toBe("shown");

    expect(dependencies.getOffer).not.toHaveBeenCalled();
    expect(dependencies.showLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "offer-9",
        productId: "product-9",
        product: { category: "GPU", vendor: "NVIDIA", model: "RTX 5070", vramGb: 12 },
        store: { name: "terabyteshop.com.br", domain: "terabyteshop.com.br" },
        effectivePriceCents: 419900,
        label: "excepcional"
      })
    );
  });

  it("applies local filters to the push summary", async () => {
    const dependencies = summaryDependencies({ followedModels: ["RX 9070 XT"] });
    await expect(
      handleOfferPush({ offerId: "offer-9", offer: JSON.stringify(summary) }, dependencies)
    ).resolves.toBe("filtered");
    expect(dependencies.getOffer).not.toHaveBeenCalled();
  });

  it("fetches the offer when the push summary is malformed", async () => {
    const dependencies = summaryDependencies();
    for (const malformed of ["not json", JSON.stringify({ ...summary, label: "otima" })]) {
      await handleOfferPush({ offerId: "offer-1", offer: malformed }, dependencies);
    }
    expect(dependencies.getOffer).toHaveBeenCalledTimes(2);
  });

  it("ignores invalid, duplicate and locally blocked notifications", async () => {
    const dependencies = {
      getOffer: vi.fn(async () => offer),
      getPreferences: vi.fn(async () => ({ ...preferences, blockedStores: ["store.example"] })),
      getHiddenIds: vi.fn(async () => new Set<string>()),
      wasShown: vi.fn(async () => false),
      markShown: vi.fn(async () => undefined),
      showLocalNotification: vi.fn(async () => undefined)
    };
    await expect(handleOfferPush({}, dependencies)).resolves.toBe("invalid");
    await expect(handleOfferPush({ offerId: "offer-1" }, dependencies)).resolves.toBe("filtered");
    dependencies.wasShown.mockResolvedValue(true);
    await expect(handleOfferPush({ offerId: "offer-1" }, dependencies)).resolves.toBe("duplicate");
    expect(dependencies.showLocalNotification).not.toHaveBeenCalled();
  });
});
