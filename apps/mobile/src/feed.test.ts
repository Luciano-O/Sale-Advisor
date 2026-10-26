import { describe, expect, it } from "vitest";

import { appendOfferPage, offersPath } from "./feed";
import type { MobileOffer } from "./types";

function offer(id: string, price = 100): MobileOffer {
  return {
    id,
    productId: "product",
    product: { category: "GPU", vendor: "NVIDIA", model: "RTX 5060", vramGb: 8 },
    store: { name: "Loja", domain: "loja.example" },
    effectivePriceCents: price,
    label: "boa",
    qualityScore: 50,
    scoreSummary: "",
    mentionCount: 1,
    firstSeenAt: "2026-10-26T12:00:00.000Z",
    lastSeenAt: "2026-10-26T12:00:00.000Z",
    url: null
  };
}

describe("offersPath", () => {
  it("requests the first page without a cursor", () => {
    expect(offersPath(null)).toBe("/v1/offers?limit=20");
  });

  it("encodes the cursor of the next page", () => {
    expect(offersPath("eyJpZCI6IngifQ==")).toBe("/v1/offers?limit=20&cursor=eyJpZCI6IngifQ%3D%3D");
  });
});

describe("appendOfferPage", () => {
  it("keeps the order and appends only offers not already listed", () => {
    const merged = appendOfferPage([offer("a"), offer("b")], [offer("b", 90), offer("c")]);

    expect(merged.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(merged[1]?.effectivePriceCents).toBe(100);
  });
});
