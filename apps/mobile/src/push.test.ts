import { describe, expect, it, vi } from "vitest";

import { handleOfferPush } from "./push";
import { DEFAULT_PREFERENCES, type LocalPreferences, type MobileOffer } from "./types";

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
  status: "active",
  history: { median30dInCents: null, lowest90dInCents: null, discountVsMedianPercent: null },
  url: "https://store.example/rx"
} satisfies MobileOffer;
const preferences: LocalPreferences = {
  ...DEFAULT_PREFERENCES,
  onboardingCompleted: true,
  followAll: true,
  alertsEnabled: true
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

  it("reads the verdict, coupon and link from the push summary", async () => {
    const dependencies = summaryDependencies();
    await handleOfferPush(
      {
        offerId: "offer-9",
        offer: JSON.stringify({
          ...summary,
          discountVsMedianPercent: 11,
          median30dInCents: 472000,
          lowest90dInCents: 410000,
          coupon: "PLACA5",
          url: "https://terabyteshop.com.br/produto/9"
        })
      },
      dependencies
    );

    expect(dependencies.getOffer).not.toHaveBeenCalled();
    expect(dependencies.showLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        coupon: "PLACA5",
        url: "https://terabyteshop.com.br/produto/9",
        history: {
          discountVsMedianPercent: 11,
          median30dInCents: 472000,
          lowest90dInCents: 410000
        }
      })
    );
  });

  it("reads a summary from before those fields existed", async () => {
    const dependencies = summaryDependencies();
    await handleOfferPush({ offerId: "offer-9", offer: JSON.stringify(summary) }, dependencies);

    expect(dependencies.showLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        coupon: null,
        url: null,
        history: {
          discountVsMedianPercent: null,
          median30dInCents: null,
          lowest90dInCents: null
        }
      })
    );
  });

  it("applies local filters to the push summary", async () => {
    const dependencies = summaryDependencies({
      followAll: false,
      subcategories: { GPU: { mode: "produtos", products: ["RX 9070 XT"] } }
    });
    await expect(
      handleOfferPush({ offerId: "offer-9", offer: JSON.stringify(summary) }, dependencies)
    ).resolves.toBe("filtered");
    expect(dependencies.getOffer).not.toHaveBeenCalled();
  });

  it("stays silent when alerts are turned off", async () => {
    const dependencies = summaryDependencies({ alertsEnabled: false });
    await expect(
      handleOfferPush({ offerId: "offer-9", offer: JSON.stringify(summary) }, dependencies)
    ).resolves.toBe("filtered");
    expect(dependencies.showLocalNotification).not.toHaveBeenCalled();
    expect(dependencies.markShown).not.toHaveBeenCalled();
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
