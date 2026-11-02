import { describe, expect, it } from "vitest";

import { isNewOffer, offerState } from "./offer-state";

const now = new Date("2026-10-29T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("offerState", () => {
  it("keeps an offer valid up to 72 hours after we last found it", () => {
    expect(offerState({ status: "active", lastSeenAt: hoursAgo(71) }, now)).toBe("valid");
    expect(offerState({ status: "active", lastSeenAt: hoursAgo(72) }, now)).toBe("valid");
  });

  it("expires an offer we have not found for more than 72 hours", () => {
    expect(offerState({ status: "active", lastSeenAt: hoursAgo(72.1) }, now)).toBe("expired");
  });

  it("trusts the server when it says the offer expired", () => {
    expect(offerState({ status: "expired", lastSeenAt: hoursAgo(1) }, now)).toBe("expired");
  });
});

describe("isNewOffer", () => {
  const lastViewedAt = hoursAgo(2);

  it("marks offers found after the last visit", () => {
    expect(isNewOffer({ firstSeenAt: hoursAgo(1) }, lastViewedAt)).toBe(true);
  });

  it("does not mark offers already there on the last visit", () => {
    expect(isNewOffer({ firstSeenAt: hoursAgo(3) }, lastViewedAt)).toBe(false);
    expect(isNewOffer({ firstSeenAt: lastViewedAt }, lastViewedAt)).toBe(false);
  });

  it("marks nothing on the first visit, when everything would be new", () => {
    expect(isNewOffer({ firstSeenAt: hoursAgo(1) }, null)).toBe(false);
  });
});
