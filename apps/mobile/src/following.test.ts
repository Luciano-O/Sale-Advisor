import { describe, expect, it } from "vitest";

import {
  productStatus,
  subcategoryModeLabel,
  subcategoryStatus,
  subcategoryStatusLabel
} from "./following";
import type { MobileOffer } from "./types";

const now = new Date("2026-10-29T12:00:00.000Z");

function offer(
  model: string,
  overrides: Partial<MobileOffer> & { discount?: number | null } = {}
): MobileOffer {
  const { discount = 10, ...rest } = overrides;
  return {
    id: `${model}-${discount}`,
    productId: model,
    product: { category: "GPU", vendor: "NVIDIA", model, vramGb: 8 },
    store: { name: "Loja", domain: "loja.example" },
    effectivePriceCents: 100000,
    label: "boa",
    qualityScore: 70,
    scoreSummary: "",
    mentionCount: 1,
    firstSeenAt: "2026-10-29T10:00:00.000Z",
    lastSeenAt: "2026-10-29T10:00:00.000Z",
    status: "active",
    history: { median30dInCents: 1, lowest90dInCents: 1, discountVsMedianPercent: discount },
    url: null,
    ...rest
  };
}
const stale = { lastSeenAt: "2026-10-20T10:00:00.000Z" };

describe("subcategoryStatusLabel", () => {
  it("counts the valid offers of the subcategory", () => {
    expect(subcategoryStatusLabel([offer("A")], "GPU", now)).toBe("1 oferta válida agora");
    expect(subcategoryStatusLabel([offer("A"), offer("B")], "GPU", now)).toBe(
      "2 ofertas válidas agora"
    );
  });

  it("ignores expired offers and other subcategories", () => {
    expect(subcategoryStatusLabel([offer("A", stale)], "GPU", now)).toBe(
      "Nenhuma oferta válida agora"
    );
    expect(subcategoryStatusLabel([offer("A")], "CPU", now)).toBe("Nenhuma oferta válida agora");
  });
});

describe("subcategoryModeLabel", () => {
  it("describes how the subcategory is followed", () => {
    expect(subcategoryModeLabel({ mode: "inteira", products: [] })).toBe(
      "Subcategoria inteira · ofertas boas ou melhores"
    );
    expect(subcategoryModeLabel({ mode: "produtos", products: ["A"] })).toBe("1 produto");
    expect(subcategoryModeLabel({ mode: "produtos", products: ["A", "B"] })).toBe("2 produtos");
    expect(subcategoryModeLabel({ mode: "produtos", products: [] })).toBe("Nenhum produto");
  });
});

describe("productStatus", () => {
  it("reports the best valid offer of the product", () => {
    const status = productStatus(
      [offer("RTX 5060", { discount: 5 }), offer("RTX 5060", { discount: 12, label: "muito_boa" })],
      "rtx 5060",
      now
    );
    expect(status).toEqual({ label: "muito_boa", discountPercent: 12 });
  });

  it("is waiting when there is no valid offer of the product", () => {
    expect(productStatus([offer("RTX 5070")], "RTX 5060", now)).toBeNull();
    expect(productStatus([offer("RTX 5060", stale)], "RTX 5060", now)).toBeNull();
  });

  it("counts an offer without history, with no discount to show", () => {
    expect(productStatus([offer("RTX 5060", { discount: null })], "RTX 5060", now)).toEqual({
      label: "boa",
      discountPercent: null
    });
  });
});

describe("subcategoryStatus", () => {
  it("reports the best valid offer of the subcategory", () => {
    expect(
      subcategoryStatus(
        [offer("A", { discount: 5 }), offer("B", { discount: 20, label: "excepcional" })],
        "GPU",
        now
      )
    ).toEqual({ label: "excepcional", discountPercent: 20 });
  });

  it("is waiting when the subcategory has no valid offer", () => {
    expect(subcategoryStatus([offer("A", stale)], "GPU", now)).toBeNull();
    expect(subcategoryStatus([offer("A")], "CPU", now)).toBeNull();
  });
});
