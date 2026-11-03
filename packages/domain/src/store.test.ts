import { describe, expect, it } from "vitest";

import { identifyStore, isNonStoreDomain, normalizeStore } from "./store.js";
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
    ],
    [
      "https://www.kabum.com.br/produto/714571/placa-de-video-gigabyte-rtx-5070-gaming-oc-12g",
      "kabum",
      "714571",
      "path:kabum-product"
    ],
    [
      "https://www.terabyteshop.com.br/produto/34860/placa-de-video-asrock-amd-radeon-rx-9070",
      "terabyte",
      "34860",
      "path:terabyte-product"
    ],
    [
      "https://www.magazineluiza.com.br/placa-de-video-msi-rtx-5060-ti/p/edb992cdf2/in/pcvd/",
      "magazine-luiza",
      "edb992cdf2",
      "path:magazine-luiza-sku"
    ],
    [
      "https://www.magazineluiza.com.br/placa-de-video-msi-rtx-5060-ti/divulgador/oferta/edb992cdf2/in/pcvd/",
      "magazine-luiza",
      "edb992cdf2",
      "path:magazine-luiza-sku"
    ]
  ])("extracts real store identity from %s", (url, adapterName, storeProductId, source) => {
    expect(normalizeStore({ normalizedUrl: requiredUrl(url) })).toMatchObject({
      adapterName,
      storeProductId,
      storeProductIdSource: source
    });
  });

  it("identifies the same store product across affiliate links", () => {
    const first = normalizeStore({
      normalizedUrl: requiredUrl(
        "https://www.kabum.com.br/produto/459144/rx-7600?aw_affid=1109753&sv1=affiliate&awc=17729_1_a"
      )
    });
    const second = normalizeStore({
      normalizedUrl: requiredUrl(
        "https://www.kabum.com.br/produto/459144/rx-7600?aw_affid=1109753&sv1=affiliate&awc=17729_2_b"
      )
    });

    expect(first.storeProductId).toBe("459144");
    expect(second.storeProductId).toBe(first.storeProductId);
  });

  it("does not treat store promotion pages as products", () => {
    expect(
      normalizeStore({ normalizedUrl: requiredUrl("https://www.kabum.com.br/promocao/CUPOM10") })
    ).toMatchObject({ adapterName: "kabum", storeProductId: null, storeProductIdSource: "none" });
    expect(
      normalizeStore({
        normalizedUrl: requiredUrl(
          "https://www.magazineluiza.com.br/botdoafiliado/divulgador/oferta/gd7fka2k39/in/waco/"
        )
      })
    ).toMatchObject({ adapterName: "magazine-luiza", storeProductId: "gd7fka2k39" });
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

  it("counts a link on a store's subdomain as that store", () => {
    expect(
      normalizeStore({
        normalizedUrl: requiredUrl(
          "https://live.shopee.com.br/universal-link/share?from=live&session=6062562"
        )
      })
    ).toMatchObject({ domain: "shopee.com.br", adapterName: "shopee" });
    expect(
      normalizeStore({
        normalizedUrl: requiredUrl("https://produto.mercadolivre.com.br/MLB-1234567890-gpu-_JM")
      })
    ).toMatchObject({ domain: "mercadolivre.com.br", storeProductId: "MLB1234567890" });
  });
});

describe("identifyStore", () => {
  it.each([
    ["amazon.com.br", "Amazon"],
    ["mercadolivre.com.br", "Mercado Livre"],
    ["shopee.com.br", "Shopee"],
    ["kabum.com.br", "KaBuM!"],
    ["terabyteshop.com.br", "Terabyte"],
    ["pichau.com.br", "Pichau"],
    ["magazineluiza.com.br", "Magazine Luiza"],
    ["aliexpress.com", "AliExpress"],
    ["patoloco.com.br", "Pato Loco"]
  ])("names %s for people to read", (domain, name) => {
    expect(identifyStore(domain)).toEqual({ domain, name });
  });

  it.each([
    ["live.shopee.com.br", "shopee.com.br", "Shopee"],
    ["m.aliexpress.com", "aliexpress.com", "AliExpress"],
    ["produto.mercadolivre.com.br", "mercadolivre.com.br", "Mercado Livre"],
    ["WWW.KABUM.COM.BR", "kabum.com.br", "KaBuM!"]
  ])("treats %s as the store itself", (input, domain, name) => {
    expect(identifyStore(input)).toEqual({ domain, name });
  });

  it("keeps the domain as the name of a store it does not know", () => {
    expect(identifyStore("www.loja-nova.example.br")).toEqual({
      domain: "loja-nova.example.br",
      name: "loja-nova.example.br"
    });
  });

  it.each(["notkabum.com.br", "kabum.com.br.example.test", "kabum.com"])(
    "does not mistake %s for a known store",
    (domain) => {
      expect(identifyStore(domain)).toEqual({ domain, name: domain });
    }
  );
});

describe("isNonStoreDomain", () => {
  it("recognizes the affiliate tool that dead offer links land on", () => {
    expect(isNonStoreDomain("aceleraafiliado.com")).toBe(true);
    expect(isNonStoreDomain("www.aceleraafiliado.com")).toBe(true);
  });

  it("accepts stores, known or not", () => {
    expect(isNonStoreDomain("kabum.com.br")).toBe(false);
    expect(isNonStoreDomain("loja-nova.example.br")).toBe(false);
  });
});

function requiredUrl(url: string) {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    throw new Error(`Expected valid URL: ${url}`);
  }

  return normalized;
}
