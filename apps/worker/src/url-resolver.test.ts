import { describe, expect, it, vi } from "vitest";

import {
  SafeUrlResolver,
  type UrlHttpClient,
  type UrlResolutionCache,
  type UrlResolutionRecord
} from "./url-resolver.js";

class MemoryCache implements UrlResolutionCache {
  readonly records = new Map<string, UrlResolutionRecord>();
  async get(key: string) {
    return this.records.get(key) ?? null;
  }
  async set(key: string, value: UrlResolutionRecord) {
    this.records.set(key, value);
  }
}

function fakeDns(entries: Record<string, string[]>) {
  return vi.fn(async (hostname: string) => entries[hostname] ?? ["93.184.216.34"]);
}

function scriptedHttp(
  responses: Array<{ status: number; location?: string; bodyBytes?: number } | Error>
): UrlHttpClient {
  return {
    request: vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error("unexpected request");
      if (next instanceof Error) throw next;
      return {
        status: next.status,
        headers: next.location ? { location: next.location } : {},
        bodyBytes: next.bodyBytes ?? 0
      };
    })
  };
}

describe("safe commercial URL resolution", () => {
  it("manually follows validated redirects and caches success for seven days", async () => {
    const cache = new MemoryCache();
    const http = scriptedHttp([
      { status: 302, location: "https://www.amazon.com.br/dp/B0ABC12345?tag=affiliate" },
      { status: 200 }
    ]);
    const resolver = new SafeUrlResolver({
      dns: fakeDns({ "aoferta.net": ["93.184.216.34"], "www.amazon.com.br": ["54.239.28.85"] }),
      http,
      cache,
      now: () => new Date("2026-08-03T12:00:00.000Z")
    });
    const first = await resolver.resolve("https://aoferta.net/abc");
    const second = await resolver.resolve("https://aoferta.net/abc");
    expect(first).toMatchObject({
      status: "resolved",
      finalUrl: "https://www.amazon.com.br/dp/B0ABC12345?tag=affiliate",
      redirectChain: [
        "https://aoferta.net/abc",
        "https://www.amazon.com.br/dp/B0ABC12345?tag=affiliate"
      ],
      attempts: 2
    });
    expect(first.expiresAt).toBe("2026-08-10T12:00:00.000Z");
    expect(second).toEqual(first);
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it.each([
    "127.0.0.1",
    "10.0.0.8",
    "169.254.169.254",
    "192.168.1.20",
    "::1",
    "fc00::1",
    "fe80::1"
  ])("blocks unsafe address %s before making HTTP requests", async (address) => {
    const http = scriptedHttp([]);
    const resolver = new SafeUrlResolver({ dns: fakeDns({ "meli.la": [address] }), http });
    expect(await resolver.resolve("https://meli.la/offer")).toMatchObject({
      status: "failed",
      error: { code: "unsafe_destination" }
    });
    expect(http.request).not.toHaveBeenCalled();
  });

  it("revalidates DNS after every redirect", async () => {
    const http = scriptedHttp([{ status: 302, location: "http://metadata.example/latest" }]);
    const resolver = new SafeUrlResolver({
      dns: fakeDns({
        "s.shopee.com.br": ["93.184.216.34"],
        "metadata.example": ["169.254.169.254"]
      }),
      http
    });
    expect(await resolver.resolve("https://s.shopee.com.br/a1")).toMatchObject({
      status: "failed",
      error: { code: "unsafe_destination" },
      attempts: 1
    });
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it("retries only network errors, 408, 429 and 5xx", async () => {
    const sleep = vi.fn(async () => undefined);
    const retriableHttp = scriptedHttp([
      new Error("network"),
      { status: 408 },
      { status: 503 },
      { status: 200 }
    ]);
    const success = await new SafeUrlResolver({
      dns: fakeDns({}),
      http: retriableHttp,
      sleep,
      maxAttemptsPerHop: 4
    }).resolve("https://meli.la/retry");
    expect(success).toMatchObject({ status: "resolved", attempts: 4 });
    expect(sleep).toHaveBeenCalledTimes(3);

    const nonRetriableHttp = scriptedHttp([{ status: 404 }, { status: 200 }]);
    const failed = await new SafeUrlResolver({
      dns: fakeDns({}),
      http: nonRetriableHttp,
      sleep
    }).resolve("https://meli.la/not-found");
    expect(failed).toMatchObject({ status: "failed", statusCode: 404, attempts: 1 });
    expect(nonRetriableHttp.request).toHaveBeenCalledTimes(1);
  });

  it("enforces redirect, response-size, protocol and credential boundaries", async () => {
    const tooMany = new SafeUrlResolver({
      dns: fakeDns({}),
      http: scriptedHttp(
        Array.from({ length: 6 }, (_, index) => ({
          status: 302,
          location: `https://meli.la/${index + 1}`
        }))
      )
    });
    expect(await tooMany.resolve("https://meli.la/0")).toMatchObject({
      status: "failed",
      error: { code: "too_many_redirects" }
    });

    const tooLarge = new SafeUrlResolver({
      dns: fakeDns({}),
      http: scriptedHttp([{ status: 200, bodyBytes: 65_537 }])
    });
    expect(await tooLarge.resolve("https://meli.la/large")).toMatchObject({
      status: "failed",
      error: { code: "response_too_large" }
    });

    const invalidRedirect = new SafeUrlResolver({
      dns: fakeDns({}),
      http: scriptedHttp([{ status: 302, location: "http://[" }])
    });
    expect(await invalidRedirect.resolve("https://meli.la/invalid-redirect")).toMatchObject({
      status: "failed",
      error: { code: "invalid_url" }
    });

    const noHttp = scriptedHttp([]);
    const invalid = new SafeUrlResolver({ dns: fakeDns({}), http: noHttp });
    expect(await invalid.resolve("ftp://meli.la/file")).toMatchObject({
      status: "failed",
      error: { code: "invalid_url" }
    });
    expect(await invalid.resolve("https://user:pass@meli.la/file")).toMatchObject({
      status: "failed",
      error: { code: "credentials_forbidden" }
    });
    expect(noHttp.request).not.toHaveBeenCalled();
  });

  it("keeps direct store URLs without fetching them", async () => {
    const http = scriptedHttp([]);
    const result = await new SafeUrlResolver({ dns: fakeDns({}), http }).resolve(
      "https://www.amazon.com.br/dp/B0ABC12345"
    );
    expect(result).toMatchObject({
      status: "direct",
      finalUrl: "https://www.amazon.com.br/dp/B0ABC12345",
      attempts: 0
    });
    expect(http.request).not.toHaveBeenCalled();
  });
});
