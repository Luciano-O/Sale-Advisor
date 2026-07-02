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
});
