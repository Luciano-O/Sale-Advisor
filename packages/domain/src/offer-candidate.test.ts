import { describe, expect, it } from "vitest";

import { buildOfferCandidate } from "./offer-candidate.js";

describe("buildOfferCandidate", () => {
  it("preserves raw text and includes detected offer signals", () => {
    const candidate = buildOfferCandidate({
      rawText:
        "RTX 4060 Ti por R$ 1.999,90 no Pix https://LOJA.com/gpu?utm_source=tg&sku=4060ti",
      capturedAt: new Date("2026-07-02T12:00:00.000Z")
    });

    expect(candidate.rawText).toContain("RTX 4060 Ti");
    expect(candidate.price?.amountInCents).toBe(199990);
    expect(candidate.normalizedUrl?.normalizedUrl).toBe("https://loja.com/gpu?sku=4060ti");
    expect(candidate.product?.model).toBe("RTX 4060 Ti");
    expect(candidate.priceBucketInCents).toBe(195000);
  });

  it("supports partial messages without breaking the pipeline", () => {
    const candidate = buildOfferCandidate({
      rawText: "Oferta chegando no canal",
      capturedAt: "2026-07-02T12:00:00.000Z"
    });

    expect(candidate.price).toBeNull();
    expect(candidate.product).toBeNull();
    expect(candidate.normalizedUrl).toBeNull();
    expect(candidate.priceBucketInCents).toBeNull();
  });
});
