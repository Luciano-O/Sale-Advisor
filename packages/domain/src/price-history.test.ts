import { describe, expect, it } from "vitest";

import {
  calculatePriceHistoryMetrics,
  createPriceSnapshots,
  scoreOffer,
  scoreOffersWithPriceHistory
} from "./price-history.js";
import type { CanonicalGpuProduct, ConsolidatedOffer } from "./types.js";

describe("price history scoring", () => {
  it("creates deterministic price snapshots from consolidated offers", () => {
    const snapshots = createPriceSnapshots([
      offer({ id: "offer-late", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 189900 }),
      offer({ id: "offer-early", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 199900 })
    ]);

    expect(snapshots).toEqual([
      {
        offerId: "offer-early",
        productId: "nvidia-rtx-4060",
        observedAt: "2026-07-01T10:00:00.000Z",
        amountInCents: 199900,
        domain: "shop.test",
        storeProductId: "SKU-1",
        mentionCount: 1
      },
      {
        offerId: "offer-late",
        productId: "nvidia-rtx-4060",
        observedAt: "2026-07-02T10:00:00.000Z",
        amountInCents: 189900,
        domain: "shop.test",
        storeProductId: "SKU-1",
        mentionCount: 1
      }
    ]);
  });

  it("uses only previous snapshots from the same product", () => {
    const current = offer({
      id: "current",
      firstSeenAt: "2026-07-10T10:00:00.000Z",
      amountInCents: 170000
    });
    const snapshots = createPriceSnapshots([
      current,
      offer({ id: "previous", firstSeenAt: "2026-07-09T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "future", firstSeenAt: "2026-07-11T10:00:00.000Z", amountInCents: 100000 }),
      offer({
        id: "other-product",
        firstSeenAt: "2026-07-09T10:00:00.000Z",
        amountInCents: 100000,
        product: product("amd-rx-7600", "AMD", "RX 7600")
      })
    ]);

    const metrics = calculatePriceHistoryMetrics(current, snapshots);

    expect(metrics.snapshotCount30d).toBe(1);
    expect(metrics.lowestPriceIn30dInCents).toBe(200000);
    expect(metrics.medianPriceIn30dInCents).toBe(200000);
    expect(metrics.usedSnapshotOfferIds30d).toEqual(["previous"]);
  });

  it("calculates lowest prices for 7d, 30d and 90d windows", () => {
    const current = offer({
      id: "current",
      firstSeenAt: "2026-07-10T10:00:00.000Z",
      amountInCents: 150000
    });
    const snapshots = createPriceSnapshots([
      current,
      offer({ id: "six-days", firstSeenAt: "2026-07-04T10:00:00.000Z", amountInCents: 210000 }),
      offer({ id: "twenty-days", firstSeenAt: "2026-06-20T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "sixty-days", firstSeenAt: "2026-05-11T10:00:00.000Z", amountInCents: 190000 }),
      offer({
        id: "ninety-five-days",
        firstSeenAt: "2026-04-06T10:00:00.000Z",
        amountInCents: 180000
      })
    ]);

    const metrics = calculatePriceHistoryMetrics(current, snapshots);

    expect(metrics.lowestPriceIn7dInCents).toBe(210000);
    expect(metrics.lowestPriceIn30dInCents).toBe(200000);
    expect(metrics.lowestPriceIn90dInCents).toBe(190000);
    expect(metrics.snapshotCount7d).toBe(1);
    expect(metrics.snapshotCount30d).toBe(2);
    expect(metrics.snapshotCount90d).toBe(3);
  });

  it("calculates odd and even 30d medians", () => {
    const oddCurrent = offer({
      id: "odd-current",
      firstSeenAt: "2026-07-10T10:00:00.000Z",
      amountInCents: 90000
    });
    const oddMetrics = calculatePriceHistoryMetrics(
      oddCurrent,
      createPriceSnapshots([
        oddCurrent,
        offer({ id: "odd-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 100000 }),
        offer({ id: "odd-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 120000 }),
        offer({ id: "odd-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 200000 })
      ])
    );

    const evenCurrent = offer({
      id: "even-current",
      firstSeenAt: "2026-07-10T10:00:00.000Z",
      amountInCents: 90000
    });
    const evenMetrics = calculatePriceHistoryMetrics(
      evenCurrent,
      createPriceSnapshots([
        evenCurrent,
        offer({ id: "even-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 100000 }),
        offer({ id: "even-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200001 }),
        offer({ id: "even-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 300000 }),
        offer({ id: "even-4", firstSeenAt: "2026-07-04T10:00:00.000Z", amountInCents: 400001 })
      ])
    );

    expect(oddMetrics.medianPriceIn30dInCents).toBe(120000);
    expect(evenMetrics.medianPriceIn30dInCents).toBe(250001);
  });

  it("calculates signed deviation against the 30d median", () => {
    const current = offer({
      id: "current",
      firstSeenAt: "2026-07-10T10:00:00.000Z",
      amountInCents: 150000
    });
    const metrics = calculatePriceHistoryMetrics(
      current,
      createPriceSnapshots([
        current,
        offer({ id: "history-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 200000 }),
        offer({ id: "history-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200000 }),
        offer({ id: "history-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 200000 })
      ])
    );

    expect(metrics.deviationFromMedian30dPercent).toBe(-25);
  });

  it("keeps the label normal when 30d history is insufficient", () => {
    const current = offer({
      id: "current",
      firstSeenAt: "2026-07-10T10:00:00.000Z",
      amountInCents: 150000
    });
    const result = scoreOffer(
      current,
      createPriceSnapshots([
        current,
        offer({ id: "history-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 200000 }),
        offer({ id: "history-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200000 })
      ])
    );

    expect(result.label).toBe("normal");
    expect(result.reasons).toContain("insufficient_history");
  });

  it("uses exact discount thresholds for labels", () => {
    expect(labelForCurrentPrice(191000)).toBe("normal");
    expect(labelForCurrentPrice(190000)).toBe("boa");
    expect(labelForCurrentPrice(180000)).toBe("muito_boa");
    expect(labelForCurrentPrice(170000)).toBe("excepcional");
  });

  it("returns an auditable deterministic scoring output", () => {
    const offers = [
      offer({ id: "current", firstSeenAt: "2026-07-10T10:00:00.000Z", amountInCents: 180000 }),
      offer({ id: "history-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "history-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "history-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 200000 })
    ];

    const result = scoreOffersWithPriceHistory(offers);

    expect(result.scoringPolicy.version).toBe("offline-price-history-v1");
    expect(result.priceSnapshots.map((snapshot) => snapshot.offerId)).toEqual([
      "history-1",
      "history-2",
      "history-3",
      "current"
    ]);
    expect(
      result.scoredOffers.find((scoredOffer) => scoredOffer.offer.id === "current")
    ).toMatchObject({
      label: "muito_boa",
      metrics: {
        medianPriceIn30dInCents: 200000,
        deviationFromMedian30dPercent: -10
      },
      audit: {
        comparedSnapshotOfferIds30d: ["history-1", "history-2", "history-3"]
      }
    });
  });
});

function labelForCurrentPrice(amountInCents: number) {
  const current = offer({
    id: `current-${amountInCents}`,
    firstSeenAt: "2026-07-10T10:00:00.000Z",
    amountInCents
  });

  return scoreOffer(
    current,
    createPriceSnapshots([
      current,
      offer({
        id: `history-1-${amountInCents}`,
        firstSeenAt: "2026-07-01T10:00:00.000Z",
        amountInCents: 200000
      }),
      offer({
        id: `history-2-${amountInCents}`,
        firstSeenAt: "2026-07-02T10:00:00.000Z",
        amountInCents: 200000
      }),
      offer({
        id: `history-3-${amountInCents}`,
        firstSeenAt: "2026-07-03T10:00:00.000Z",
        amountInCents: 200000
      })
    ])
  ).label;
}

function offer(overrides: {
  id: string;
  firstSeenAt: string;
  amountInCents: number;
  product?: CanonicalGpuProduct;
}): ConsolidatedOffer {
  return {
    id: overrides.id,
    product: overrides.product ?? product("nvidia-rtx-4060", "NVIDIA", "RTX 4060"),
    price: {
      amountInCents: overrides.amountInCents,
      currency: "BRL",
      paymentMethod: "pix",
      rawText: formatPrice(overrides.amountInCents)
    },
    priceBucketInCents: overrides.amountInCents,
    normalizedUrl: `https://shop.test/${overrides.id}`,
    store: {
      domain: "shop.test",
      adapterName: "shop",
      storeProductId: "SKU-1",
      storeProductIdSource: "query:sku"
    },
    storeProductId: "SKU-1",
    domain: "shop.test",
    firstSeenAt: overrides.firstSeenAt,
    lastSeenAt: overrides.firstSeenAt,
    mentionCount: 1
  };
}

function product(id: string, vendor: "NVIDIA" | "AMD", model: string): CanonicalGpuProduct {
  return {
    id,
    vendor,
    model
  };
}

function formatPrice(amountInCents: number): string {
  return `R$ ${(amountInCents / 100).toFixed(2)}`;
}
