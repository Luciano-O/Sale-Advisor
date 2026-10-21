import { describe, expect, it, vi } from "vitest";

import { loadFeed } from "./cache";
import type { MobileOffer } from "./types";

const cached = [{ id: "cached" }] as MobileOffer[];
const fresh = [{ id: "fresh" }] as MobileOffer[];
const starter = [{ id: "starter" }] as MobileOffer[];

describe("offline feed cache", () => {
  it("persists a successful response and reports fresh data", async () => {
    const cache = { read: vi.fn(async () => cached), replace: vi.fn(async () => undefined) };
    await expect(loadFeed(cache, async () => fresh)).resolves.toEqual({
      offers: fresh,
      source: "network",
      error: null
    });
    expect(cache.replace).toHaveBeenCalledWith(fresh);
  });

  it("returns cached offers with an offline error when refresh fails", async () => {
    const cache = { read: vi.fn(async () => cached), replace: vi.fn(async () => undefined) };
    await expect(
      loadFeed(cache, async () => Promise.reject(new Error("network unavailable")))
    ).resolves.toEqual({ offers: cached, source: "cache", error: "network unavailable" });
  });

  it("uses the bundled starter feed when both the network and cache are empty", async () => {
    const cache = { read: vi.fn(async () => []), replace: vi.fn(async () => undefined) };

    await expect(
      loadFeed(cache, async () => Promise.reject(new Error("network unavailable")), starter)
    ).resolves.toEqual({
      offers: starter,
      source: "starter",
      error: "network unavailable"
    });

    expect(cache.replace).not.toHaveBeenCalled();
  });

  it("prefers a real cached feed over bundled starter offers", async () => {
    const cache = { read: vi.fn(async () => cached), replace: vi.fn(async () => undefined) };

    await expect(
      loadFeed(cache, async () => Promise.reject(new Error("network unavailable")), starter)
    ).resolves.toEqual({ offers: cached, source: "cache", error: "network unavailable" });
  });
});
