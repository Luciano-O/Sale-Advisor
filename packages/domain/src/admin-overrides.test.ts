import { describe, expect, it } from "vitest";

import { applyAdminOverrides, parseAdminOverrides } from "./admin-overrides.js";
import { buildOfferCandidate } from "./offer-candidate.js";

const candidate = buildOfferCandidate({
  rawText: "RTX 5060 8GB por R$ 1.999 no Pix cupom GPU10",
  capturedAt: "2026-10-21T12:00:00.000Z",
  url: "https://www.kabum.com.br/produto/123/rtx-5060"
});

describe("parseAdminOverrides", () => {
  it("accepts the supported correction fields", () => {
    expect(
      parseAdminOverrides({
        productKey: "nvidia-rtx-5060-ti-16gb",
        priceInCents: 249_900,
        coupon: null,
        storeProductId: "999",
        notAnOffer: false
      })
    ).toEqual({
      ok: true,
      overrides: {
        productKey: "nvidia-rtx-5060-ti-16gb",
        priceInCents: 249_900,
        coupon: null,
        storeProductId: "999",
        notAnOffer: false
      }
    });
  });

  it("rejects unknown fields and invalid values", () => {
    expect(parseAdminOverrides({ model: "RTX 5060" })).toEqual({
      ok: false,
      error: "unsupported_field:model"
    });
    expect(parseAdminOverrides({ priceInCents: -1 })).toEqual({
      ok: false,
      error: "invalid_value:priceInCents"
    });
    expect(parseAdminOverrides({ priceInCents: 10.5 })).toEqual({
      ok: false,
      error: "invalid_value:priceInCents"
    });
    expect(parseAdminOverrides({ productKey: "" })).toEqual({
      ok: false,
      error: "invalid_value:productKey"
    });
    expect(parseAdminOverrides("not an object")).toEqual({ ok: false, error: "invalid_overrides" });
  });
});

describe("applyAdminOverrides", () => {
  it("replaces the price and recalculates its bucket", () => {
    const corrected = applyAdminOverrides(candidate, { priceInCents: 249_900 });

    expect(corrected.price).toMatchObject({ amountInCents: 249_900, currency: "BRL" });
    expect(corrected.priceBucketInCents).not.toBe(candidate.priceBucketInCents);
  });

  it("uses the resolved product for a product correction", () => {
    const product = {
      id: "nvidia-rtx-5060-ti-16gb",
      vendor: "NVIDIA",
      model: "RTX 5060 Ti",
      vramGb: 16
    } as const;

    expect(applyAdminOverrides(candidate, { productKey: product.id }, product).product).toEqual(
      product
    );
  });

  it("corrects coupon and store product id", () => {
    const corrected = applyAdminOverrides(candidate, { coupon: null, storeProductId: "999" });

    expect(corrected.coupon).toBeNull();
    expect(corrected.storeProductId).toBe("999");
    expect(corrected.store?.storeProductId).toBe("999");
  });

  it("removes the product when the message is marked as not an offer", () => {
    expect(applyAdminOverrides(candidate, { notAnOffer: true }).product).toBeNull();
  });

  it("returns the candidate unchanged without overrides", () => {
    expect(applyAdminOverrides(candidate, {})).toEqual(candidate);
  });
});
