import { describe, expect, it } from "vitest";

import { parsePrice } from "./price.js";

describe("parsePrice", () => {
  it("extracts BRL prices with currency symbol", () => {
    expect(parsePrice("RTX 4060 por R$ 1.999,90")).toEqual({
      amountInCents: 199990,
      currency: "BRL",
      paymentMethod: "unknown",
      rawText: "R$ 1.999,90"
    });
  });

  it("extracts decimal prices followed by pix context", () => {
    expect(parsePrice("RTX 4060 1999,90 no pix")?.amountInCents).toBe(199990);
    expect(parsePrice("RTX 4060 1999,90 no pix")?.paymentMethod).toBe("pix");
  });

  it("extracts integer prices with thousands separator", () => {
    expect(parsePrice("RX 7600 por R$ 2.199")?.amountInCents).toBe(219900);
  });

  it("prioritizes pix or cash prices over installment prices", () => {
    const parsed = parsePrice("10x de R$ 229,90 ou R$ 1.999,90 no Pix");

    expect(parsed?.amountInCents).toBe(199990);
    expect(parsed?.paymentMethod).toBe("pix");
  });

  it("returns null when no price is present", () => {
    expect(parsePrice("Oferta de placa de video hoje")).toBeNull();
  });

  it("does not read coupon discounts or their minimum purchase as a price", () => {
    expect(parsePrice("🔥 Cupom Shopee\n\n🏷️ R$ 100 OFF a partir de R$ 999")).toBeNull();
    expect(
      parsePrice("🎟️ R$ 20 OFF acima de R$ 189\n🎟️ R$ 30 OFF acima de R$ 279\n🎟️ 30% OFF")
    ).toBeNull();
    expect(parsePrice("🏷️ 10% OFF Limite de R$ 200 OFF a partir de R$ 800: BORA")).toBeNull();
    expect(parsePrice("Ganhe R$ 50 de desconto em compras com valor mínimo de R$ 500")).toBeNull();
  });

  it("keeps the product price when the message also lists coupons", () => {
    expect(
      parsePrice(
        "Placa de Vídeo RTX 5060 8GB\n\n💵 R$ 2372\n\n🏷️ Resgate os cupons:\nR$ 100 OFF: https://s.shopee.com.br/5\nR$ 50 OFF acima de R$ 1.500"
      )?.amountInCents
    ).toBe(237200);
    expect(parsePrice("RX 9070 XT 16GB\n💵 R$ 5219 com cupom: PROMO10")?.amountInCents).toBe(
      521900
    );
  });
});
