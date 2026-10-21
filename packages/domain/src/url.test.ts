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

  it("removes affiliate parameters used by Awin and Magazine Luiza links", () => {
    expect(
      normalizeUrl(
        "https://www.kabum.com.br/produto/1?aw_affid=1&sv1=affiliate&sv_campaign_id=1&awc=17729_1_a"
      )?.normalizedUrl
    ).toBe("https://www.kabum.com.br/produto/1");
    expect(
      normalizeUrl("https://www.magazineluiza.com.br/x/p/abc/?promoter_id=3&partner_id=3440")
        ?.normalizedUrl
    ).toBe("https://www.magazineluiza.com.br/x/p/abc/");
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
