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
});
