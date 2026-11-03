import { describe, expect, it } from "vitest";

import { buildOfferCandidate } from "./offer-candidate.js";

describe("buildOfferCandidate", () => {
  it("uses the final resolved URL in parser v3 while preserving source URLs", () => {
    const candidate = buildOfferCandidate({
      rawText: "RTX 4060 8GB por R$ 1.899 no Pix https://aoferta.net/abc cupom GPU10",
      capturedAt: "2026-08-03T12:00:00.000Z",
      resolvedUrl: "https://www.amazon.com.br/dp/B0ABC12345?tag=affiliate"
    });
    expect(candidate).toMatchObject({
      parserVersion: 3,
      sourceUrl: "https://www.amazon.com.br/dp/B0ABC12345?tag=affiliate",
      domain: "amazon.com.br",
      storeProductId: "B0ABC12345",
      coupon: "GPU10",
      condition: "unknown",
      price: { amountInCents: 189900, paymentMethod: "pix" }
    });
    expect(candidate.sourceUrls).toContain("https://aoferta.net/abc");
  });

  it("finds no store when the link lands on an affiliate tool, keeping the URLs for audit", () => {
    const candidate = buildOfferCandidate({
      rawText: "RTX 5060 Ti 16GB por R$ 3699 https://aoferta.net/003vyUsR-Terabyte",
      capturedAt: "2026-08-18T12:00:00.000Z",
      resolvedUrl: "https://aceleraafiliado.com/"
    });
    expect(candidate).toMatchObject({
      store: null,
      domain: null,
      storeProductId: null,
      sourceUrl: "https://aceleraafiliado.com/"
    });
    expect(candidate.sourceUrls).toContain("https://aoferta.net/003vyUsR-Terabyte");
  });

  it("files a link on a store's subdomain under the store", () => {
    const candidate = buildOfferCandidate({
      rawText: "RTX 5060 8GB por R$ 2.989 no Pix",
      capturedAt: "2026-10-10T12:00:00.000Z",
      resolvedUrl: "https://live.shopee.com.br/universal-link/share?from=live&session=7405350"
    });
    expect(candidate.domain).toBe("shopee.com.br");
    expect(candidate.store?.domain).toBe("shopee.com.br");
  });

  it("does not consolidate a shortener domain when resolution failed", () => {
    const candidate = buildOfferCandidate({
      rawText: "RTX 4060 por R$ 1.899 https://meli.la/failure",
      capturedAt: "2026-08-03T12:00:00.000Z",
      urlResolutionFailed: true
    });
    expect(candidate).toMatchObject({
      parserVersion: 3,
      sourceUrl: null,
      store: null,
      domain: null,
      urlResolutionFailed: true
    });
  });

  it("preserves raw text and includes detected offer signals", () => {
    const candidate = buildOfferCandidate({
      rawText: "RTX 4060 Ti por R$ 1.999,90 no Pix https://LOJA.com/gpu?utm_source=tg&sku=4060ti",
      capturedAt: new Date("2026-07-02T12:00:00.000Z")
    });

    expect(candidate.rawText).toContain("RTX 4060 Ti");
    expect(candidate.price?.amountInCents).toBe(199990);
    expect(candidate.normalizedUrl?.normalizedUrl).toBe("https://loja.com/gpu?sku=4060ti");
    expect(candidate.product?.model).toBe("RTX 4060 Ti");
    expect(candidate.priceBucketInCents).toBe(195000);
  });

  it("fills normalized store and store product id from URL", () => {
    const candidate = buildOfferCandidate({
      rawText:
        "RTX 4060 por R$ 1.899,00 https://www.loja-a.example.br/produto?sku=RTX4060-8GB&utm_source=tg",
      capturedAt: "2026-07-02T12:00:00.000Z"
    });

    expect(candidate.domain).toBe("loja-a.example.br");
    expect(candidate.store).toMatchObject({
      domain: "loja-a.example.br",
      adapterName: "loja-a",
      storeProductId: "RTX4060-8GB",
      storeProductIdSource: "query:sku"
    });
    expect(candidate.storeProductId).toBe("RTX4060-8GB");
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

  it("preserves every source URL and prefers a non-Telegram offer URL", () => {
    const candidate = buildOfferCandidate({
      rawText:
        "RTX 4060 por R$ 1.899 no Pix https://t.me/ofertas. Veja também https://shop.example/gpu?sku=4060&utm_source=telegram)",
      capturedAt: "2026-07-02T12:00:00.000Z",
      urls: [
        "https://t.me/ofertas",
        "https://shop.example/gpu?sku=4060&utm_source=telegram",
        "https://shop.example/gpu?sku=4060&utm_source=telegram"
      ]
    });

    expect(candidate.sourceUrls).toEqual([
      "https://t.me/ofertas",
      "https://shop.example/gpu?sku=4060&utm_source=telegram"
    ]);
    expect(candidate.sourceUrl).toBe("https://shop.example/gpu?sku=4060&utm_source=telegram");
    expect(candidate.normalizedUrl?.normalizedUrl).toBe("https://shop.example/gpu?sku=4060");
  });
});
