import { describe, expect, it } from "vitest";

import { normalizeUrl } from "./url.js";

describe("normalizeUrl", () => {
  it("removes tracking parameters", () => {
    const normalized = normalizeUrl(
      "https://EXAMPLE.com/produto?utm_source=telegram&fbclid=abc&gclid=def&ref=promo&tag=afiliado"
    );

    expect(normalized).toEqual({
      originalUrl:
        "https://EXAMPLE.com/produto?utm_source=telegram&fbclid=abc&gclid=def&ref=promo&tag=afiliado",
      normalizedUrl: "https://example.com/produto",
      domain: "example.com",
      path: "/produto",
      removedTrackingParams: ["utm_source", "fbclid", "gclid", "ref", "tag"]
    });
  });

  it("preserves useful non-tracking parameters", () => {
    expect(normalizeUrl("https://loja.com/item?sku=123&utm_medium=social")?.normalizedUrl).toBe(
      "https://loja.com/item?sku=123"
    );
  });

  it("normalizes host casing", () => {
    expect(normalizeUrl("https://LoJa.COM/Produto")?.domain).toBe("loja.com");
  });

  it("returns null for invalid urls", () => {
    expect(normalizeUrl("not a url")).toBeNull();
  });
});
