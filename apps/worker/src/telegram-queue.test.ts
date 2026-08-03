import { describe, expect, it } from "vitest";

import { DEFAULT_JOB_OPTIONS } from "./queue-config.js";
import { telegramIngestJobId } from "./telegram-queue.js";

describe("Telegram ingest queue", () => {
  it("builds safe deterministic job ids and reuses the standard retry policy", () => {
    expect(telegramIngestJobId("-1001234567890", "42")).toBe(
      telegramIngestJobId("-1001234567890", "42")
    );
    expect(telegramIngestJobId("-1001234567890", "42")).not.toBe(
      telegramIngestJobId("-1001234567890", "43")
    );
    expect(telegramIngestJobId("-1001234567890", "42")).toMatch(/^telegram-ingest-[a-f0-9]{64}$/);
    expect(DEFAULT_JOB_OPTIONS).toMatchObject({
      attempts: 5,
      backoff: { type: "exponential" }
    });
  });
});
