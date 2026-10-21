import { describe, expect, it } from "vitest";

import { advanceCheckpoint } from "./reprocess-checkpoint.js";

describe("advanceCheckpoint", () => {
  it("keeps the database timestamp precision so the last row is not selected again", () => {
    const checkpoint = advanceCheckpoint(null, [
      { id: "11111111-1111-4111-8111-111111111111", createdAt: "2026-08-03 18:17:15.000001+00" },
      { id: "a8185ed8-2ba4-45dd-aa5d-591aa2ea10d1", createdAt: "2026-08-03 18:17:16.062521+00" }
    ]);

    expect(checkpoint).toEqual({
      createdAt: "2026-08-03 18:17:16.062521+00",
      id: "a8185ed8-2ba4-45dd-aa5d-591aa2ea10d1",
      processed: 2
    });
  });

  it("accumulates the processed count across batches", () => {
    const checkpoint = advanceCheckpoint(
      { createdAt: "2026-08-03 18:17:16.062521+00", id: "a", processed: 100 },
      [{ id: "b", createdAt: "2026-08-04 10:00:00.5+00" }]
    );

    expect(checkpoint.processed).toBe(101);
    expect(checkpoint.createdAt).toBe("2026-08-04 10:00:00.5+00");
  });
});
