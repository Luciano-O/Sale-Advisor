import { describe, expect, it } from "vitest";

import { normalizeStore } from "./store.js";
import { normalizeUrl } from "./url.js";

describe("normalizeStore", () => {
  it.each([
    ["https://www.amazon.com.br/dp/B0ABC12345", "amazon-br", "B0ABC12345", "path:amazon-asin"],
    ["https://amazon.com.br/gp/product/B0XYZ98765", "amazon-br", "B0XYZ98765", "path:amazon-asin"],
    ["https://amazon.com.br/gp/aw/d/B012345678", "amazon-br", "B012345678", "path:amazon-asin"],
    [
      "https://produto.mercadolivre.com.br/MLB-1234567890-gpu-_JM",
      "mercado-livre",
      "MLB1234567890",
      "path:mercado-livre-item"
    ],
    [
      "https://www.mercadolivre.com.br/item/MLB987654321",
      "mercado-livre",
      "MLB987654321",
      "path:mercado-livre-item"
    ],
    [
      "https://shopee.com.br/product/123456789/987654321",
      "shopee",
      "123456789:987654321",
      "path:shopee-item"
    ],
    [
      "https://shopee.com.br/GPU-i.123456789.987654321",
      "shopee",
      "123456789:987654321",
      "path:shopee-item"
    ]
  ])("extracts real store identity from %s", (url, adapterName, storeProductId, source) => {
    expect(normalizeStore({ normalizedUrl: requiredUrl(url) })).toMatchObject({
      adapterName,
      storeProductId,
      storeProductIdSource: source
    });
  });

  it("normalizes domain casing and removes www prefix", () => {
    const store = normalizeStore({
      normalizedUrl: requiredUrl("https://WWW.LOJA-A.EXAMPLE.BR/produto?sku=ABC123")
    });

    expect(store).toMatchObject({
      domain: "loja-a.example.br",
      storeProductId: "ABC123",
      storeProductIdSource: "query:sku"
    });
  });

  it("extracts store product id from sku query parameter", () => {
    const store = normalizeStore({
      normalizedUrl: requiredUrl("https://loja-a.example.br/gpu/rtx-4060?sku=RTX4060-8GB")
    });

    expect(store.storeProductId).toBe("RTX4060-8GB");
    expect(store.storeProductIdSource).toBe("query:sku");
  });

  it("extracts store product id from productId and produtoId query parameters", () => {
    const byProductId = normalizeStore({
      normalizedUrl: requiredUrl("https://loja-b.example.br/item?productId=98765")
    });
    const byProdutoId = normalizeStore({
      normalizedUrl: requiredUrl("https://loja-b.example.br/item?produtoId=54321")
    });

    expect(byProductId.storeProductId).toBe("98765");
    expect(byProductId.storeProductIdSource).toBe("query:productId");
    expect(byProdutoId.storeProductId).toBe("54321");
    expect(byProdutoId.storeProductIdSource).toBe("query:produtoId");
  });

  it("extracts a stable numeric id from loja-c path", () => {
    const store = normalizeStore({
      normalizedUrl: requiredUrl("https://loja-c.example.br/produto/rtx-4060-8gb/123456")
    });

    expect(store.storeProductId).toBe("123456");
    expect(store.storeProductIdSource).toBe("path:numeric-id");
  });

  it("uses generic query extraction for unknown domains", () => {
    const store = normalizeStore({
      normalizedUrl: requiredUrl("https://marketplace.example.br/oferta?id=GEN-42")
    });

    expect(store).toMatchObject({
      domain: "marketplace.example.br",
      adapterName: "generic",
      storeProductId: "GEN-42",
      storeProductIdSource: "query:id"
    });
  });

  it("returns null store product id when no reliable id exists", () => {
    const store = normalizeStore({
      normalizedUrl: requiredUrl("https://loja-a.example.br/promocoes/rtx-4060")
    });

    expect(store.storeProductId).toBeNull();
    expect(store.storeProductIdSource).toBe("none");
  });
});

function requiredUrl(url: string) {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    throw new Error(`Expected valid URL: ${url}`);
  }

  return normalized;
}
