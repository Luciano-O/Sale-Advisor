import { describe, expect, it } from "vitest";

import { anonymousEventBatchSchema, offerCursorSchema, offerHistoryFromMetrics } from "./public.js";

const NO_HISTORY = {
  median30dInCents: null,
  lowest90dInCents: null,
  discountVsMedianPercent: null
};

describe("public contracts", () => {
  it("caps feed pages at 50 items", () => {
    expect(offerCursorSchema.parse({ limit: "50" }).limit).toBe(50);
    expect(() => offerCursorSchema.parse({ limit: "51" })).toThrow();
  });

  it("orders the feed by most recent unless the biggest discount is asked for", () => {
    expect(offerCursorSchema.parse({}).sort).toBe("recent");
    expect(offerCursorSchema.parse({ sort: "discount" }).sort).toBe("discount");
    expect(() => offerCursorSchema.parse({ sort: "label" })).toThrow();
  });

  it("accepts only the anonymous MVP event allowlist and at most 100 events", () => {
    const valid = {
      events: [
        {
          id: "168f1d1e-d51c-45a6-8465-a86f5e9af177",
          installationId: "5fa72ea4-2441-45cd-8993-4d56e837cc4a",
          name: "offer_clicked",
          occurredAt: "2026-07-14T12:00:00.000Z"
        }
      ]
    };
    expect(anonymousEventBatchSchema.parse(valid).events).toHaveLength(1);
    expect(() =>
      anonymousEventBatchSchema.parse({
        events: [{ ...valid.events[0], name: "email_collected" }]
      })
    ).toThrow();
    expect(() =>
      anonymousEventBatchSchema.parse({
        events: Array.from({ length: 101 }, (_, index) => ({
          ...valid.events[0],
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
        }))
      })
    ).toThrow();
  });
});

describe("offerHistoryFromMetrics", () => {
  it("exposes the 30-day median, the 90-day low and the discount against the median", () => {
    expect(
      offerHistoryFromMetrics({
        medianPriceIn30dInCents: 200000,
        lowestPriceIn90dInCents: 190000,
        deviationFromMedian30dPercent: -11.5,
        snapshotCount30d: 4
      })
    ).toEqual({
      median30dInCents: 200000,
      lowest90dInCents: 190000,
      discountVsMedianPercent: 11.5
    });
  });

  it("reports a price above the median as a negative discount", () => {
    expect(
      offerHistoryFromMetrics({
        medianPriceIn30dInCents: 200000,
        lowestPriceIn90dInCents: 180000,
        deviationFromMedian30dPercent: 5
      }).discountVsMedianPercent
    ).toBe(-5);
  });

  it("reports a price equal to the median as no discount, never negative zero", () => {
    const { discountVsMedianPercent } = offerHistoryFromMetrics({
      medianPriceIn30dInCents: 200000,
      lowestPriceIn90dInCents: 200000,
      deviationFromMedian30dPercent: 0
    });
    expect(Object.is(discountVsMedianPercent, 0)).toBe(true);
  });

  it("leaves every value null when the history is insufficient or unreadable", () => {
    expect(offerHistoryFromMetrics({})).toEqual(NO_HISTORY);
    expect(offerHistoryFromMetrics(null)).toEqual(NO_HISTORY);
    expect(offerHistoryFromMetrics("metrics")).toEqual(NO_HISTORY);
    expect(
      offerHistoryFromMetrics({
        medianPriceIn30dInCents: null,
        lowestPriceIn90dInCents: null,
        deviationFromMedian30dPercent: null
      })
    ).toEqual(NO_HISTORY);
  });

  it("drops values that are not a usable price or percentage", () => {
    expect(
      offerHistoryFromMetrics({
        medianPriceIn30dInCents: "200000",
        lowestPriceIn90dInCents: -1,
        deviationFromMedian30dPercent: Number.NaN
      })
    ).toEqual(NO_HISTORY);
  });

  it("keeps the 90-day low when the 30-day window had no prices", () => {
    expect(
      offerHistoryFromMetrics({
        medianPriceIn30dInCents: null,
        lowestPriceIn90dInCents: 190000,
        deviationFromMedian30dPercent: null
      })
    ).toEqual({ ...NO_HISTORY, lowest90dInCents: 190000 });
  });
});
