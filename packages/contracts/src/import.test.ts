import { describe, expect, it } from "vitest";

import { importBatchSchema } from "./import.js";

describe("importBatchSchema", () => {
  it("accepts the versioned MVP import contract", () => {
    const parsed = importBatchSchema.parse({
      schemaVersion: 1,
      source: { name: "Carga inicial", kind: "import" },
      notifyEligible: false,
      messages: [
        {
          externalId: "offer-1",
          text: "RTX 4060 8GB por R$ 1.899 no Pix",
          capturedAt: "2026-07-14T12:00:00.000Z",
          url: "https://example.com/gpu"
        }
      ]
    });

    expect(parsed.messages).toHaveLength(1);
    expect(parsed.notifyEligible).toBe(false);
  });

  it("rejects more than 1,000 messages and text over 10,000 characters", () => {
    const message = {
      text: "RTX 4060 por R$ 1.899",
      capturedAt: "2026-07-14T12:00:00.000Z"
    };

    expect(() =>
      importBatchSchema.parse({
        schemaVersion: 1,
        source: { name: "Carga", kind: "import" },
        messages: Array.from({ length: 1_001 }, () => message)
      })
    ).toThrow();
    expect(() =>
      importBatchSchema.parse({
        schemaVersion: 1,
        source: { name: "Carga", kind: "import" },
        messages: [{ ...message, text: "x".repeat(10_001) }]
      })
    ).toThrow();
  });

  it("defaults historical imports to notifications disabled", () => {
    const parsed = importBatchSchema.parse({
      schemaVersion: 1,
      source: { name: "Carga", kind: "import" },
      messages: [{ text: "RX 7600 por R$ 1.500", capturedAt: "2026-07-14T12:00:00.000Z" }]
    });

    expect(parsed.notifyEligible).toBe(false);
  });
});
