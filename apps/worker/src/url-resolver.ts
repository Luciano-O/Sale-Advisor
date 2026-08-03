import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { BlockList, isIP } from "node:net";

export const URL_RESOLVER_VERSION = "safe-redirect-v1";
export const KNOWN_SHORTENER_HOSTS = new Set(["aoferta.net", "s.shopee.com.br", "meli.la"]);

export interface UrlResolutionRecord {
  originalUrl: string;
  finalUrl: string | null;
  redirectChain: string[];
  status: "direct" | "resolved" | "failed";
  statusCode: number | null;
  resolverVersion: string;
  attempts: number;
  error: { code: string } | null;
  resolvedAt: string;
  expiresAt: string | null;
}

export interface UrlResolutionCache {
  get(key: string): Promise<UrlResolutionRecord | null>;
  set(key: string, value: UrlResolutionRecord): Promise<void>;
}

export interface UrlHttpResponse {
  status: number;
  headers: { location?: string };
  bodyBytes: number;
}

export interface UrlHttpClient {
  request(url: URL, address: string): Promise<UrlHttpResponse>;
}

export interface SafeUrlResolverOptions {
  dns?: (hostname: string) => Promise<string[]>;
  http?: UrlHttpClient;
  cache?: UrlResolutionCache;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttemptsPerHop?: number;
}

export class SafeUrlResolver {
  private readonly dns: NonNullable<SafeUrlResolverOptions["dns"]>;
  private readonly http: UrlHttpClient;
  private readonly cache: UrlResolutionCache | undefined;
  private readonly now: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxAttemptsPerHop: number;

  constructor(options: SafeUrlResolverOptions = {}) {
    this.dns = options.dns ?? resolveAddresses;
    this.http = options.http ?? new NodeUrlHttpClient();
    this.cache = options.cache;
    this.now = options.now ?? (() => new Date());
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxAttemptsPerHop = options.maxAttemptsPerHop ?? 3;
  }

  async resolve(originalUrl: string): Promise<UrlResolutionRecord> {
    const parsed = parseSafeUrl(originalUrl);
    if ("error" in parsed) return this.failed(originalUrl, [], 0, null, parsed.error);
    const initial = parsed.url;
    if (!KNOWN_SHORTENER_HOSTS.has(normalizeHostname(initial.hostname))) {
      return this.success(
        originalUrl,
        initial.toString(),
        [initial.toString()],
        0,
        null,
        "direct",
        false
      );
    }
    const cacheKey = createHash("sha256").update(originalUrl).digest("hex");
    const cached = await this.cache?.get(cacheKey);
    if (cached?.expiresAt && Date.parse(cached.expiresAt) > this.now().getTime()) return cached;

    let current = initial;
    const redirectChain = [current.toString()];
    let attempts = 0;
    let redirects = 0;
    while (true) {
      const validation = await this.validateDestination(current);
      if ("error" in validation) {
        return this.failed(originalUrl, redirectChain, attempts, null, validation.error);
      }
      let response: UrlHttpResponse | null = null;
      let lastStatusCode: number | null = null;
      let lastCode = "network_error";
      for (let attempt = 1; attempt <= this.maxAttemptsPerHop; attempt += 1) {
        attempts += 1;
        try {
          response = await this.http.request(current, validation.address);
          lastStatusCode = response.status;
          if (response.bodyBytes > 64 * 1_024) {
            return this.failed(
              originalUrl,
              redirectChain,
              attempts,
              response.status,
              "response_too_large"
            );
          }
          if (!isRetriableStatus(response.status)) break;
          lastCode = "retriable_http_status";
        } catch {
          lastCode = "network_error";
        }
        response = null;
        if (attempt < this.maxAttemptsPerHop)
          await this.sleep(Math.min(2 ** (attempt - 1) * 100, 1_000));
      }
      if (!response)
        return this.failed(originalUrl, redirectChain, attempts, lastStatusCode, lastCode);
      if (isRedirect(response.status)) {
        const location = response.headers.location;
        if (!location)
          return this.failed(
            originalUrl,
            redirectChain,
            attempts,
            response.status,
            "redirect_without_location"
          );
        if (redirects >= 5)
          return this.failed(
            originalUrl,
            redirectChain,
            attempts,
            response.status,
            "too_many_redirects"
          );
        const next = parseRedirect(location, current);
        if ("error" in next)
          return this.failed(originalUrl, redirectChain, attempts, response.status, next.error);
        current = next.url;
        redirectChain.push(current.toString());
        redirects += 1;
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        return this.failed(originalUrl, redirectChain, attempts, response.status, "http_status");
      }
      const result = this.success(
        originalUrl,
        current.toString(),
        redirectChain,
        attempts,
        response.status,
        "resolved",
        true
      );
      await this.cache?.set(cacheKey, result);
      return result;
    }
  }

  private async validateDestination(url: URL): Promise<{ address: string } | { error: string }> {
    const hostname = normalizeHostname(url.hostname);
    let addresses: string[];
    try {
      addresses = isIP(hostname) ? [hostname] : await this.dns(hostname);
    } catch {
      return { error: "dns_failure" };
    }
    if (addresses.length === 0) return { error: "dns_failure" };
    if (addresses.some((address) => !isPublicAddress(address)))
      return { error: "unsafe_destination" };
    return { address: addresses[0]! };
  }

  private success(
    originalUrl: string,
    finalUrl: string,
    redirectChain: string[],
    attempts: number,
    statusCode: number | null,
    status: "direct" | "resolved",
    cache: boolean
  ): UrlResolutionRecord {
    const now = this.now();
    return {
      originalUrl,
      finalUrl,
      redirectChain,
      status,
      statusCode,
      resolverVersion: URL_RESOLVER_VERSION,
      attempts,
      error: null,
      resolvedAt: now.toISOString(),
      expiresAt: cache ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString() : null
    };
  }

  private failed(
    originalUrl: string,
    redirectChain: string[],
    attempts: number,
    statusCode: number | null,
    code: string
  ): UrlResolutionRecord {
    return {
      originalUrl,
      finalUrl: null,
      redirectChain,
      status: "failed",
      statusCode,
      resolverVersion: URL_RESOLVER_VERSION,
      attempts,
      error: { code },
      resolvedAt: this.now().toISOString(),
      expiresAt: null
    };
  }
}

export class NodeUrlHttpClient implements UrlHttpClient {
  request(url: URL, address: string): Promise<UrlHttpResponse> {
    return new Promise((resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      let settled = false;
      const request = transport.request(
        {
          protocol: url.protocol,
          hostname: address,
          port: url.port || undefined,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers: {
            host: url.host,
            accept: "text/html,application/xhtml+xml",
            "user-agent": "SaleAdvisorUrlResolver/1"
          },
          ...(url.protocol === "https:" ? { servername: normalizeHostname(url.hostname) } : {})
        },
        (response) => {
          let bodyBytes = 0;
          const finish = () => {
            if (settled) return;
            settled = true;
            const location = Array.isArray(response.headers.location)
              ? response.headers.location[0]
              : response.headers.location;
            resolve({
              status: response.statusCode ?? 0,
              headers: location ? { location } : {},
              bodyBytes
            });
          };
          response.on("data", (chunk: Buffer) => {
            bodyBytes += chunk.length;
            if (bodyBytes > 64 * 1_024) {
              finish();
              response.destroy();
            }
          });
          response.on("end", finish);
          response.on("error", reject);
        }
      );
      request.setTimeout(5_000, () => request.destroy(new Error("request_timeout")));
      request.on("error", (error) => {
        if (!settled) reject(error);
      });
      request.end();
    });
  }
}

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const)
  blockedIpv4.addSubnet(network, prefix, "ipv4");
const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:2::", 48],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8]
] as const)
  blockedIpv6.addSubnet(network, prefix, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  return (
    family !== 0 &&
    !(family === 4 ? blockedIpv4.check(address, "ipv4") : blockedIpv6.check(address, "ipv6"))
  );
}

async function resolveAddresses(hostname: string) {
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function parseSafeUrl(value: string): { url: URL } | { error: string } {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "invalid_url" };
    if (url.username || url.password) return { error: "credentials_forbidden" };
    return { url };
  } catch {
    return { error: "invalid_url" };
  }
}

function parseRedirect(location: string, current: URL): { url: URL } | { error: string } {
  try {
    return parseSafeUrl(new URL(location, current).toString());
  } catch {
    return { error: "invalid_url" };
  }
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function isRetriableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}
