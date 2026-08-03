import { describe, expect, it, vi } from "vitest";

import {
  classifyTelegramFailure,
  computeTelegramRetry,
  sanitizeTelegramError
} from "./telegram-operations.js";

describe("Telegram operational failure policy", () => {
  it.each([
    ["AUTH_KEY_UNREGISTERED", "authentication_invalid"],
    ["SESSION_REVOKED", "session_revoked"],
    ["API_ID_INVALID", "api_id_invalid"],
    ["CHANNEL_PRIVATE", "source_inaccessible"]
  ] as const)("blocks %s without automatic retry", (code, category) => {
    const failure = classifyTelegramFailure(Object.assign(new Error("sensitive"), { code }));
    expect(failure).toMatchObject({ category, retry: "blocked" });
    expect(computeTelegramRetry(failure, 1, vi.fn())).toBeNull();
  });

  it("honors FloodWait before retrying and adds at most 20% jitter", () => {
    const failure = classifyTelegramFailure(
      Object.assign(new Error("FLOOD_WAIT_30"), { seconds: 30 })
    );
    expect(failure).toMatchObject({ category: "flood_wait", retry: "after", waitMs: 30_000 });
    expect(computeTelegramRetry(failure, 1, () => 0.5)).toBe(33_000);
  });

  it("uses exponential retry capped at 60 seconds for transient failures", () => {
    const failure = classifyTelegramFailure(
      Object.assign(new Error("socket timeout"), { code: "ETIMEDOUT" })
    );
    expect(failure).toMatchObject({ category: "transient", retry: "backoff" });
    expect(computeTelegramRetry(failure, 1, () => 0)).toBe(1_000);
    expect(computeTelegramRetry(failure, 7, () => 0)).toBe(60_000);
    expect(computeTelegramRetry(failure, 7, () => 1)).toBe(72_000);
  });

  it("blocks an unknown failure after five consecutive attempts", () => {
    const failure = classifyTelegramFailure(new Error("unexpected payload"));
    expect(computeTelegramRetry(failure, 4, () => 0)).toBe(8_000);
    expect(computeTelegramRetry(failure, 5, () => 0)).toBeNull();
  });

  it("never exposes credentials, peer identifiers or complete error messages", () => {
    const secret = "session=abc api_hash=deadbeef phone=+5511999999999 peer=-1001234567890";
    const sanitized = sanitizeTelegramError(
      Object.assign(new Error(`${secret} server rejected it`), { code: "SESSION_REVOKED" })
    );
    expect(sanitized).toEqual({ name: "Error", code: "SESSION_REVOKED" });
    expect(JSON.stringify(sanitized)).not.toContain("abc");
    expect(JSON.stringify(sanitized)).not.toContain("-1001234567890");
  });
});
