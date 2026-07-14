import type { NormalizedStore, NormalizeStoreInput, StoreProductIdSource } from "./types.js";

const GENERIC_QUERY_ID_PARAMS = ["sku", "productId", "produtoId", "itemId", "id"] as const;

type QueryIdParam = (typeof GENERIC_QUERY_ID_PARAMS)[number];

interface StoreAdapterDefinition {
  name: string;
  domain: string;
  extractStoreProductId: (url: URL) => StoreProductIdMatch | null;
}

interface StoreProductIdMatch {
  value: string;
  source: StoreProductIdSource;
}

const STORE_ADAPTERS: StoreAdapterDefinition[] = [
  {
    name: "loja-a",
    domain: "loja-a.example.br",
    extractStoreProductId: (url) => extractQueryParam(url, "sku")
  },
  {
    name: "loja-b",
    domain: "loja-b.example.br",
    extractStoreProductId: (url) => extractFirstQueryParam(url, ["productId", "produtoId"])
  },
  {
    name: "loja-c",
    domain: "loja-c.example.br",
    extractStoreProductId: extractNumericPathId
  }
];

export function normalizeStore(input: NormalizeStoreInput): NormalizedStore {
  const domain = normalizeDomain(input.normalizedUrl?.domain ?? input.storeDomain ?? "");
  const parsedUrl = input.normalizedUrl ? new URL(input.normalizedUrl.normalizedUrl) : null;
  const adapter = STORE_ADAPTERS.find((candidate) => candidate.domain === domain);
  const match = parsedUrl ? adapter?.extractStoreProductId(parsedUrl) ?? extractGenericStoreProductId(parsedUrl) : null;

  return {
    domain,
    adapterName: adapter?.name ?? "generic",
    storeProductId: match?.value ?? null,
    storeProductIdSource: match?.source ?? "none"
  };
}

export function normalizeStoreDomain(domain: string): string {
  return normalizeDomain(domain);
}

function normalizeDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

function extractGenericStoreProductId(url: URL): StoreProductIdMatch | null {
  return extractFirstQueryParam(url, GENERIC_QUERY_ID_PARAMS);
}

function extractFirstQueryParam(url: URL, params: readonly QueryIdParam[]): StoreProductIdMatch | null {
  for (const param of params) {
    const match = extractQueryParam(url, param);

    if (match) {
      return match;
    }
  }

  return null;
}

function extractQueryParam(url: URL, param: QueryIdParam): StoreProductIdMatch | null {
  const value = url.searchParams.get(param)?.trim();

  if (!value) {
    return null;
  }

  return {
    value,
    source: `query:${param}`
  };
}

function extractNumericPathId(url: URL): StoreProductIdMatch | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  if (!lastSegment || !/^\d+$/.test(lastSegment)) {
    return null;
  }

  return {
    value: lastSegment,
    source: "path:numeric-id"
  };
}
