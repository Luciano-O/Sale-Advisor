import { describe, expect, it } from "vitest";

import { anonymousEventBatchSchema, offerCursorSchema } from "./public.js";

describe("public contracts", () => {
  it("caps feed pages at 50 items", () => {
    expect(offerCursorSchema.parse({ limit: "50" }).limit).toBe(50);
    expect(() => offerCursorSchema.parse({ limit: "51" })).toThrow();
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
