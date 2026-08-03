import { describe, expect, it, vi } from "vitest";

import { RateLimitGuard } from "./rate-limit.guard.js";

describe("RateLimitGuard", () => {
  it("rejects requests over the configured per-minute limit", () => {
    const guard = new RateLimitGuard({ limit: 2, windowMs: 60_000 });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: "127.0.0.1", socket: {}, route: { path: "/v1/offers" } })
      })
    };
    expect(guard.canActivate(context as never)).toBe(true);
    expect(guard.canActivate(context as never)).toBe(true);
    expect(() => guard.canActivate(context as never)).toThrow(/rate limit/i);
  });

  it("resets the counter after the time window", () => {
    vi.useFakeTimers();
    const guard = new RateLimitGuard({ limit: 1, windowMs: 1_000 });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: "client", socket: {}, route: { path: "/" } })
      })
    };
    expect(guard.canActivate(context as never)).toBe(true);
    vi.advanceTimersByTime(1_001);
    expect(guard.canActivate(context as never)).toBe(true);
    vi.useRealTimers();
  });
});
