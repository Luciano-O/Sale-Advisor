import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCatalog, updateBroadPreferences } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown = {}) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("updateBroadPreferences", () => {
  it("sends only the category and the fixed threshold, never the fine preferences", async () => {
    const fetchMock = stubFetch();

    await updateBroadPreferences("installation-1");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/installations/installation-1/notification-preferences");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ category: "GPU", minimumLabel: "boa" });
  });
});

describe("fetchCatalog", () => {
  it("keeps the subcategory of each model", async () => {
    stubFetch({ items: [{ category: "GPU", vendor: "NVIDIA", model: "RTX 5060" }] });

    await expect(fetchCatalog()).resolves.toEqual([
      { category: "GPU", vendor: "NVIDIA", model: "RTX 5060" }
    ]);
  });
});
