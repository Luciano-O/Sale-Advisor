import { describe, expect, it } from "vitest";

import { buildOfferCandidate } from "./offer-candidate.js";
import { deduplicateOfferCandidates } from "./deduplication.js";
import type { OfferCandidate } from "./types.js";

describe("deduplicateOfferCandidates", () => {
  it("prioritizes domain, store product id and price over different normalized URLs", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-store-1",
        rawText:
          "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/produto/rtx-4060?sku=RTX4060-8GB&utm_source=tg",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-store-2",
        rawText:
          "RTX 4060 por R$ 1.899,00 https://loja-a.example.br/oferta/especial?sku=RTX4060-8GB&fbclid=abc",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.storeProductId).toBe("RTX4060-8GB");
    expect(result.offers[0]?.mentionCount).toBe(2);
  });

  it("creates a new offer for the same store product id when price differs", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-store-price-1",
        rawText: "RX 7600 por R$ 1.499,00 https://loja-b.example.br/item?productId=RX7600-1",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-store-price-2",
        rawText: "RX 7600 por R$ 1.549,00 https://loja-b.example.br/item?productId=RX7600-1",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(2);
  });

  it("does not consolidate different products with the same store product id", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-store-product-1",
        rawText: "RTX 4060 por R$ 1.899,00 https://loja-b.example.br/item?productId=SAME-ID",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-store-product-2",
        rawText: "RTX 4070 por R$ 1.899,00 https://loja-b.example.br/item?productId=SAME-ID",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(2);
  });

  it("consolidates two mentions with the same normalized URL and price within 48 hours", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-1",
        rawText: "RTX 4060 por R$ 1.899,00 no pix https://loja.com/gpu?sku=4060&utm_source=tg",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-2",
        rawText: "RTX 4060 saindo por R$ 1.899,00 https://loja.com/gpu?sku=4060&fbclid=abc",
        capturedAt: "2026-07-02T12:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.mentionCount).toBe(2);
    expect(result.offerMentions).toHaveLength(2);
    expect(result.offerMentions.map((mention) => mention.offerId)).toEqual([
      "offer_0001",
      "offer_0001"
    ]);
  });

  it("deduplicates URLs that differ only by tracking parameters", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-1",
        rawText: "RTX 4070 por R$ 3.299,90 https://store.test/item?sku=4070&utm_campaign=promo",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-2",
        rawText: "RTX 4070 por R$ 3.299,90 https://store.test/item?fbclid=abc&sku=4070",
        capturedAt: "2026-07-02T10:05:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.normalizedUrl).toBe("https://store.test/item?sku=4070");
  });

  it("falls back to product, domain, price bucket and exact price when URL is absent", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-1",
        rawText: "RTX 4060 Ti no pix por R$ 2.299,00",
        capturedAt: "2026-07-02T10:00:00.000Z",
        storeDomain: "hardware.test"
      }),
      candidate({
        rawMessageId: "raw-2",
        rawText: "Nova chamada: RTX 4060 Ti R$ 2.299,00",
        capturedAt: "2026-07-02T11:00:00.000Z",
        storeDomain: "hardware.test"
      })
    ]);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.mentionCount).toBe(2);
    expect(result.offers[0]?.domain).toBe("hardware.test");
  });

  it("creates a new offer when mentions are more than 48 hours apart", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-1",
        rawText: "RX 7600 por R$ 1.499,00 https://shop.test/rx7600",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-2",
        rawText: "RX 7600 por R$ 1.499,00 https://shop.test/rx7600",
        capturedAt: "2026-07-04T10:00:01.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(2);
    expect(result.offerMentions.map((mention) => mention.offerId)).toEqual([
      "offer_0001",
      "offer_0002"
    ]);
  });

  it("creates a new offer when the price differs", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-1",
        rawText: "RX 6600 por R$ 1.099,00 https://shop.test/rx6600",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-2",
        rawText: "RX 6600 por R$ 1.149,00 https://shop.test/rx6600",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(2);
  });

  it("creates a new offer when the canonical product differs", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-1",
        rawText: "RTX 4060 por R$ 1.899,00 https://shop.test/gpu",
        capturedAt: "2026-07-02T10:00:00.000Z"
      }),
      candidate({
        rawMessageId: "raw-2",
        rawText: "RTX 4070 por R$ 1.899,00 https://shop.test/gpu",
        capturedAt: "2026-07-02T11:00:00.000Z"
      })
    ]);

    expect(result.offers).toHaveLength(2);
  });

  it("preserves raw text and raw message id in mentions", () => {
    const result = deduplicateOfferCandidates([
      candidate({
        rawMessageId: "raw-audit-1",
        rawText: "Texto bruto da oferta RTX 4060 por R$ 1.899,00 https://audit.test/gpu",
        capturedAt: "2026-07-02T10:00:00.000Z"
      })
    ]);

    expect(result.offerMentions[0]).toMatchObject({
      rawMessageId: "raw-audit-1",
      rawText: "Texto bruto da oferta RTX 4060 por R$ 1.899,00 https://audit.test/gpu",
      sourceName: "Canal Teste",
      capturedAt: "2026-07-02T10:00:00.000Z",
      offerId: "offer_0001"
    });
    expect(result.offerMentions[0]?.candidate.rawText).toContain("Texto bruto da oferta");
  });
});

function candidate(input: {
  rawMessageId: string;
  rawText: string;
  capturedAt: string;
  sourceName?: string;
  storeDomain?: string;
}): OfferCandidate {
  return buildOfferCandidate({
    rawMessageId: input.rawMessageId,
    sourceName: input.sourceName ?? "Canal Teste",
    rawText: input.rawText,
    capturedAt: input.capturedAt,
    storeDomain: input.storeDomain
  });
}
