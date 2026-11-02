import { describe, expect, it } from "vitest";

import { buildFcmMessage } from "./notification.js";

const summary = {
  productId: "4b8f0a52-3c1e-4d7a-9f60-2a1b3c4d5e6f",
  vendor: "NVIDIA",
  model: "RTX 5070",
  vramGb: 12,
  storeName: "terabyteshop.com.br",
  storeDomain: "terabyteshop.com.br",
  priceCents: 419900,
  label: "excepcional"
} as const;

describe("buildFcmMessage", () => {
  it("sends a high-priority data-only message with the offer summary as strings", () => {
    const message = buildFcmMessage("device-token", { offerId: "offer-1", summary });

    expect(message).toEqual({
      token: "device-token",
      data: { offerId: "offer-1", offer: JSON.stringify(summary) },
      android: { priority: "high", ttl: 24 * 60 * 60 * 1_000 }
    });
    expect(Object.values(message.data).every((value) => typeof value === "string")).toBe(true);
    expect(message).not.toHaveProperty("notification");
  });

  it("keeps sending only the offer id when no summary is available", () => {
    expect(buildFcmMessage("device-token", { offerId: "offer-1" }).data).toEqual({
      offerId: "offer-1"
    });
  });
  it("carries the verdict data, coupon and store link the alert shows", () => {
    const rich = {
      ...summary,
      discountVsMedianPercent: 11,
      median30dInCents: 471900,
      lowest90dInCents: 414800,
      coupon: "PLACA10",
      url: "https://www.terabyteshop.com.br/produto/12345/rtx-5070"
    };

    const message = buildFcmMessage("device-token", { offerId: "offer-1", summary: rich });

    expect(JSON.parse(message.data.offer!)).toEqual(rich);
  });

  it("drops the store link before the data payload goes over the FCM 4 KB limit", () => {
    const url = `https://www.terabyteshop.com.br/produto/12345/${"a".repeat(5_000)}`;
    const message = buildFcmMessage("device-token", {
      offerId: "4b8f0a52-3c1e-4d7a-9f60-2a1b3c4d5e6f",
      summary: { ...summary, coupon: "PLACA10", url }
    });

    const size = Object.entries(message.data).reduce(
      (total, [key, value]) => total + Buffer.byteLength(key) + Buffer.byteLength(value),
      0
    );
    expect(size).toBeLessThanOrEqual(4_096);
    const sent = JSON.parse(message.data.offer!);
    expect(sent).not.toHaveProperty("url");
    expect(sent).toMatchObject({ coupon: "PLACA10", priceCents: 419900 });
  });
});
