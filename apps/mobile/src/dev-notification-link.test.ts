import { describe, expect, it, vi } from "vitest";

import { handleDevelopmentNotificationLink } from "./dev-notification-link";

describe("development notification deep link", () => {
  it("validates the route and delegates to the existing push handler", async () => {
    const handleOfferPush = vi.fn(async () => "shown" as const);

    await expect(
      handleDevelopmentNotificationLink(
        "saleadvisor://debug-notification?offerId=offer-123",
        true,
        handleOfferPush
      )
    ).resolves.toBe("shown");
    expect(handleOfferPush).toHaveBeenCalledOnce();
    expect(handleOfferPush).toHaveBeenCalledWith({ offerId: "offer-123" });
  });

  it("returns invalid for a missing offer and never delegates outside development", async () => {
    const handleOfferPush = vi.fn(async () => "shown" as const);

    await expect(
      handleDevelopmentNotificationLink("saleadvisor://debug-notification", true, handleOfferPush)
    ).resolves.toBe("invalid");
    await expect(
      handleDevelopmentNotificationLink(
        "saleadvisor://debug-notification?offerId=offer-123",
        false,
        handleOfferPush
      )
    ).resolves.toBe("disabled");
    expect(handleOfferPush).not.toHaveBeenCalled();
  });

  it("ignores unrelated links", async () => {
    const handleOfferPush = vi.fn(async () => "shown" as const);

    await expect(
      handleDevelopmentNotificationLink("saleadvisor://offer/offer-123", true, handleOfferPush)
    ).resolves.toBe("ignored");
    expect(handleOfferPush).not.toHaveBeenCalled();
  });
});
