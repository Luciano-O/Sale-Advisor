import { describe, expect, it } from "vitest";

import { anonymizeMessageText, sanitizeResolvedUrl, selectEvenly } from "./fixture-export.js";

describe("anonymizeMessageText", () => {
  it("replaces links, Telegram handles and invite links while keeping offer details", () => {
    const text = [
      "Placa De Video Asrock Radeon RX 9070 XT 16GB",
      "💵 R$ 5219 com cupom: PROMO10",
      "✅ Link do produto: https://aoferta.net/002zDmIm-Kabum",
      "🔔 BOT DE ALERTAS: https://t.me/alertadaspromobot",
      "Siga @canaldepromos e t.me/+AbCdEf123"
    ].join("\n");

    const anonymized = anonymizeMessageText(text);

    expect(anonymized).toBe(
      [
        "Placa De Video Asrock Radeon RX 9070 XT 16GB",
        "💵 R$ 5219 com cupom: PROMO10",
        "✅ Link do produto: https://link.invalid/1",
        "🔔 BOT DE ALERTAS: https://link.invalid/2",
        "Siga @canal e https://link.invalid/3"
      ].join("\n")
    );
  });

  it("keeps e-mail-like text and prices untouched", () => {
    expect(anonymizeMessageText("RTX 5060 por R$ 1.999,90 no pix, sac: contato@loja")).toBe(
      "RTX 5060 por R$ 1.999,90 no pix, sac: contato@loja"
    );
  });
});

describe("sanitizeResolvedUrl", () => {
  it("keeps only the store host, path and product identifier parameters", () => {
    expect(
      sanitizeResolvedUrl(
        "https://www.kabum.com.br/produto/123456/placa?awc=999_affiliate&utm_source=tg&sku=ABC"
      )
    ).toBe("https://www.kabum.com.br/produto/123456/placa?sku=ABC");
    expect(
      sanitizeResolvedUrl("https://www.amazon.com.br/dp/B0DTEST123?tag=afiliado-20&th=1")
    ).toBe("https://www.amazon.com.br/dp/B0DTEST123");
  });

  it("drops unresolved shortener links, whose path is an affiliate code", () => {
    expect(sanitizeResolvedUrl("https://amzn.to/4aBcDeF")).toBeNull();
    expect(sanitizeResolvedUrl("https://s.shopee.com.br/1qcyxtNfP7")).toBeNull();
    expect(sanitizeResolvedUrl("https://a.aliexpress.com/_mKxyz")).toBeNull();
  });

  it("returns null for missing or invalid URLs", () => {
    expect(sanitizeResolvedUrl(null)).toBeNull();
    expect(sanitizeResolvedUrl("not a url")).toBeNull();
  });
});

describe("selectEvenly", () => {
  it("spreads the selection across the whole list", () => {
    expect(selectEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4)).toEqual([1, 4, 7, 10]);
  });

  it("returns every item when the list is smaller than the limit", () => {
    expect(selectEvenly([1, 2], 5)).toEqual([1, 2]);
    expect(selectEvenly([], 5)).toEqual([]);
  });
});
