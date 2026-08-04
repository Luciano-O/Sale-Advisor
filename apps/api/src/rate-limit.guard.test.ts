import { describe, expect, it } from "vitest";

import { InMemoryRateLimitStore, RateLimitGuard } from "./rate-limit.guard.js";

function context(path = "/v1/offers") {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip: "127.0.0.1", socket: {}, route: { path } }),
      getResponse: () => ({ setHeader: () => undefined })
    })
  } as never;
}

describe("RateLimitGuard", () => {
  it("shares counters across guard instances", async () => {
    const store = new InMemoryRateLimitStore();
    const first = new RateLimitGuard(store, { limit: 2, windowSeconds: 60 });
    const second = new RateLimitGuard(store, { limit: 2, windowSeconds: 60 });
    await expect(first.canActivate(context())).resolves.toBe(true);
    await expect(second.canActivate(context())).resolves.toBe(true);
    await expect(first.canActivate(context())).rejects.toMatchObject({ status: 429 });
  });

  it("excludes liveness and readiness from rate limiting", async () => {
    const store = new InMemoryRateLimitStore();
    const guard = new RateLimitGuard(store, { limit: 1, windowSeconds: 60 });
    await expect(guard.canActivate(context("/v1/health/live"))).resolves.toBe(true);
    await expect(guard.canActivate(context("/v1/health/ready"))).resolves.toBe(true);
    expect(store.size).toBe(0);
  });

  it("returns service unavailable when the distributed store fails", async () => {
    const guard = new RateLimitGuard(
      { increment: async () => Promise.reject(new Error("redis://secret-host")) },
      { limit: 1, windowSeconds: 60 }
    );
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 503 });
  });
});
