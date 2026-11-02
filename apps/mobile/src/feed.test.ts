import { describe, expect, it } from "vitest";

import {
  appendOfferPage,
  hiddenOfferSnapshot,
  offerCountLabel,
  offersPath,
  sortOffers,
  subcategoryFilters,
  visibleOffers,
  withOfferDefaults,
  type CachedOffer
} from "./feed";
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
    status: "active",
    history: { median30dInCents: null, lowest90dInCents: null, discountVsMedianPercent: null },
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

  it("asks for the biggest discounts when the user chooses them", () => {
    expect(offersPath(null, "discount")).toBe("/v1/offers?limit=20&sort=discount");
    expect(offersPath("abc", "discount")).toBe("/v1/offers?limit=20&sort=discount&cursor=abc");
  });
});

describe("appendOfferPage", () => {
  it("keeps the order and appends only offers not already listed", () => {
    const merged = appendOfferPage([offer("a"), offer("b")], [offer("b", 90), offer("c")]);

    expect(merged.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(merged[1]?.effectivePriceCents).toBe(100);
  });
});

describe("sortOffers", () => {
  const seen = (id: string, firstSeenAt: string, discount: number | null): MobileOffer => ({
    ...offer(id),
    firstSeenAt,
    history: { median30dInCents: 1, lowest90dInCents: 1, discountVsMedianPercent: discount }
  });
  const older = seen("older", "2026-10-25T12:00:00.000Z", 30);
  const newer = seen("newer", "2026-10-27T12:00:00.000Z", 5);
  const noHistory = seen("no-history", "2026-10-28T12:00:00.000Z", null);

  it("puts the most recently found first, like the API", () => {
    expect(sortOffers([older, noHistory, newer], "recent").map(({ id }) => id)).toEqual([
      "no-history",
      "newer",
      "older"
    ]);
  });

  it("puts the biggest discount first and offers without history last, like the API", () => {
    expect(sortOffers([noHistory, newer, older], "discount").map(({ id }) => id)).toEqual([
      "older",
      "newer",
      "no-history"
    ]);
  });

  it("breaks ties the way the API does, so pages stay consistent", () => {
    const a = seen("a", "2026-10-25T12:00:00.000Z", 10);
    const b = seen("b", "2026-10-25T12:00:00.000Z", 10);
    const recentTie = seen("c", "2026-10-26T12:00:00.000Z", 10);
    expect(sortOffers([a, recentTie, b], "discount").map(({ id }) => id)).toEqual(["c", "b", "a"]);
    expect(sortOffers([a, b], "recent").map(({ id }) => id)).toEqual(["b", "a"]);
  });

  it("does not change the list it receives", () => {
    const list = [older, newer];
    sortOffers(list, "recent");
    expect(list.map(({ id }) => id)).toEqual(["older", "newer"]);
  });
});

describe("visibleOffers", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const valid = { ...offer("valid"), lastSeenAt: "2026-10-27T10:00:00.000Z" };
  const stale = { ...offer("stale"), lastSeenAt: "2026-10-20T10:00:00.000Z" };

  it("lists only valid offers", () => {
    expect(visibleOffers([valid, stale], { now }).map(({ id }) => id)).toEqual(["valid"]);
  });

  it("narrows to one subcategory", () => {
    expect(visibleOffers([valid], { now, category: "GPU" })).toHaveLength(1);
    expect(visibleOffers([valid], { now, category: "CPU" })).toHaveLength(0);
  });

  it("narrows to one model, ignoring case", () => {
    expect(visibleOffers([valid], { now, model: "rtx 5060" })).toHaveLength(1);
    expect(visibleOffers([valid], { now, model: "RTX 5070" })).toHaveLength(0);
  });
});

describe("subcategoryFilters", () => {
  it("is not worth showing with a single subcategory", () => {
    expect(subcategoryFilters(["GPU"])).toEqual([]);
    expect(subcategoryFilters([])).toEqual([]);
  });

  it("offers everything plus each subcategory from two on", () => {
    expect(subcategoryFilters(["GPU", "CPU"])).toEqual([
      { key: "all", label: "Tudo" },
      { key: "GPU", label: "Placas de vídeo" },
      { key: "CPU", label: "CPU" }
    ]);
  });
});

describe("offerCountLabel", () => {
  it("counts the offers on the list", () => {
    expect(offerCountLabel(0, false)).toBe("0 ofertas");
    expect(offerCountLabel(1, false)).toBe("1 oferta");
    expect(offerCountLabel(6, false)).toBe("6 ofertas");
  });

  it("does not pretend to know the total while there are more pages", () => {
    expect(offerCountLabel(20, true)).toBe("20+ ofertas");
  });
});

describe("withOfferDefaults", () => {
  it("completes an offer cached before the app knew about history and status", () => {
    const cached: Partial<MobileOffer> = offer("cached");
    delete cached.status;
    delete cached.history;
    expect(withOfferDefaults(cached as CachedOffer)).toEqual(offer("cached"));
  });

  it("keeps what the cached offer already has", () => {
    const expired: MobileOffer = {
      ...offer("expired"),
      status: "expired",
      history: { median30dInCents: 10, lowest90dInCents: 9, discountVsMedianPercent: 1 }
    };
    expect(withOfferDefaults(expired)).toEqual(expired);
  });
});

describe("hiddenOfferSnapshot", () => {
  it("keeps what the hidden offers list shows, even after the offer is gone", () => {
    expect(hiddenOfferSnapshot(offer("a", 189990))).toEqual({
      name: "RTX 5060 8GB",
      storeName: "Loja",
      priceCents: 189990
    });
  });
});
