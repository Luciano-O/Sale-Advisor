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
