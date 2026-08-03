import { describe, expect, it } from "vitest";

import {
  buildOfferCandidate,
  identifyGpuProduct,
  parsePriceQuotes,
  selectEffectivePrice
} from "./index.js";

describe("enriched offer parsing", () => {
  it("keeps VRAM variants as different canonical products", () => {
    expect(identifyGpuProduct("RTX 4060 Ti 8GB")).toMatchObject({
      id: "nvidia-rtx-4060-ti-8gb",
      model: "RTX 4060 Ti",
      vramGb: 8
    });
    expect(identifyGpuProduct("RTX 4060 Ti 16 GB")).toMatchObject({
      id: "nvidia-rtx-4060-ti-16gb",
      vramGb: 16
    });
    expect(identifyGpuProduct("RTX 4060 Ti sem informação de memória")).toMatchObject({
      id: "nvidia-rtx-4060-ti-unknown-vram",
      vramGb: null
    });
  });

  it("extracts all price quotes and selects Pix before cash and installments", () => {
    const quotes = parsePriceQuotes(
      "R$ 2.199 em 10x de R$ 219,90 ou R$ 1.899,00 no Pix; boleto R$ 1.999,00"
    );

    expect(quotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "pix", amountInCents: 189900 }),
        expect.objectContaining({ method: "cash", amountInCents: 199900 }),
        expect.objectContaining({ method: "installment", totalInCents: 219900, installments: 10 })
      ])
    );
    expect(selectEffectivePrice(quotes)).toMatchObject({ method: "pix", amountInCents: 189900 });
  });

  it("enriches brand, condition, coupon and parser version without requiring all fields", () => {
    const candidate = buildOfferCandidate({
      rawText: "ASUS RTX 4070 Super 12GB open box por R$ 3.499 no Pix cupom GPU200",
      capturedAt: "2026-07-14T12:00:00.000Z",
      storeDomain: "example.com"
    });

    expect(candidate).toMatchObject({
      boardBrand: "ASUS",
      condition: "open_box",
      coupon: "GPU200",
      parserVersion: 2,
      effectivePrice: { amountInCents: 349900, method: "pix" }
    });
  });
});
