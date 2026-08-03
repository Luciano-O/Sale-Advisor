import { describe, expect, it } from "vitest";

import { scoreOffer } from "./price-history.js";
import type { ConsolidatedOffer, PriceSnapshot } from "./types.js";

function offer(overrides: Partial<ConsolidatedOffer> = {}): ConsolidatedOffer {
  return {
    id: "current",
    product: { id: "nvidia-rtx-4060-8gb", vendor: "NVIDIA", model: "RTX 4060", vramGb: 8 },
    price: { amountInCents: 170000, currency: "BRL", paymentMethod: "pix", rawText: "R$ 1.700" },
    priceBucketInCents: 170000,
    normalizedUrl: null,
    store: {
      domain: "shop.example",
      adapterName: "generic",
      storeProductId: null,
      storeProductIdSource: "none"
    },
    storeProductId: null,
    domain: "shop.example",
    firstSeenAt: "2026-07-14T12:00:00.000Z",
    lastSeenAt: "2026-07-14T12:00:00.000Z",
    mentionCount: 4,
    storeReliability: 90,
    coupon: null,
    observedPricesInCents: [170000],
    ...overrides
  };
}

describe("quality score", () => {
  it("keeps the label driven by history while auxiliary signals rank the offer", () => {
    const snapshots: PriceSnapshot[] = [1, 2, 3].map((day) => ({
      offerId: `old-${day}`,
      productId: "nvidia-rtx-4060-8gb",
      observedAt: `2026-07-${10 + day}T12:00:00.000Z`,
      amountInCents: 200000,
      domain: "shop.example",
      storeProductId: null,
      mentionCount: 1
    }));

    const scored = scoreOffer(offer(), snapshots);
    expect(scored.label).toBe("excepcional");
    expect(scored.qualityScore).toBe(100);
    expect(scored.confidence).toBe("high");
    expect(scored.reasons).toEqual(expect.arrayContaining(["lowest_price_7d", "trusted_store"]));
  });

  it("uses normal and low confidence when history is insufficient", () => {
    const scored = scoreOffer(offer({ mentionCount: 1, storeReliability: 20 }), []);
    expect(scored).toMatchObject({ label: "normal", confidence: "low" });
    expect(scored.qualityScore).toBeGreaterThanOrEqual(0);
  });
});
