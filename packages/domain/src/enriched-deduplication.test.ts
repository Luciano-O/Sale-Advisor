import { describe, expect, it } from "vitest";

import { buildOfferCandidate, deduplicateOfferCandidates } from "./index.js";

describe("enriched deduplication", () => {
  it("groups exact prices that share the R$ 50 bucket in layer three and preserves observations", () => {
    const result = deduplicateOfferCandidates([
      buildOfferCandidate({
        rawMessageId: "one",
        rawText: "RTX 4060 8GB por R$ 1.901 no Pix cupom GPU",
        capturedAt: "2026-07-14T10:00:00.000Z",
        storeDomain: "shop.example"
      }),
      buildOfferCandidate({
        rawMessageId: "two",
        rawText: "RTX 4060 8GB por R$ 1.949 no Pix cupom GPU",
        capturedAt: "2026-07-14T11:00:00.000Z",
        storeDomain: "shop.example"
      })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      price: { amountInCents: 194900 },
      observedPricesInCents: [190100, 194900],
      coupon: "GPU"
    });
  });

  it("does not merge offers with different coupons", () => {
    const base = {
      capturedAt: "2026-07-14T10:00:00.000Z",
      storeDomain: "shop.example"
    };
    const result = deduplicateOfferCandidates([
      buildOfferCandidate({ ...base, rawText: "RTX 4060 8GB R$ 1.901 Pix cupom A10" }),
      buildOfferCandidate({ ...base, rawText: "RTX 4060 8GB R$ 1.901 Pix cupom B10" })
    ]);
    expect(result.offers).toHaveLength(2);
  });
});
