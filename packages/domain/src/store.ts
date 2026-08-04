import type { NormalizedStore, NormalizeStoreInput, StoreProductIdSource } from "./types.js";

const GENERIC_QUERY_ID_PARAMS = ["sku", "productId", "produtoId", "itemId", "id"] as const;

type QueryIdParam = (typeof GENERIC_QUERY_ID_PARAMS)[number];

interface StoreAdapterDefinition {
  name: string;
  matchesDomain: (domain: string) => boolean;
  extractStoreProductId: (url: URL) => StoreProductIdMatch | null;
}

interface StoreProductIdMatch {
  value: string;
  source: StoreProductIdSource;
}

const STORE_ADAPTERS: StoreAdapterDefinition[] = [
  {
    name: "amazon-br",
    matchesDomain: (domain) => domain === "amazon.com.br",
    extractStoreProductId: extractAmazonAsin
  },
  {
    name: "mercado-livre",
    matchesDomain: (domain) =>
      domain === "mercadolivre.com.br" || domain.endsWith(".mercadolivre.com.br"),
    extractStoreProductId: extractMercadoLivreItem
  },
  {
    name: "shopee",
    matchesDomain: (domain) => domain === "shopee.com.br" || domain.endsWith(".shopee.com.br"),
    extractStoreProductId: extractShopeeItem
  },
  {
    name: "loja-a",
    matchesDomain: (domain) => domain === "loja-a.example.br",
    extractStoreProductId: (url) => extractQueryParam(url, "sku")
  },
  {
    name: "loja-b",
    matchesDomain: (domain) => domain === "loja-b.example.br",
    extractStoreProductId: (url) => extractFirstQueryParam(url, ["productId", "produtoId"])
  },
  {
    name: "loja-c",
    matchesDomain: (domain) => domain === "loja-c.example.br",
    extractStoreProductId: extractNumericPathId
  }
];

export function normalizeStore(input: NormalizeStoreInput): NormalizedStore {
  const domain = normalizeDomain(input.normalizedUrl?.domain ?? input.storeDomain ?? "");
  const parsedUrl = input.normalizedUrl ? new URL(input.normalizedUrl.normalizedUrl) : null;
  const adapter = STORE_ADAPTERS.find((candidate) => candidate.matchesDomain(domain));
  const match = parsedUrl
    ? (adapter?.extractStoreProductId(parsedUrl) ?? extractGenericStoreProductId(parsedUrl))
    : null;

  return {
    domain,
    adapterName: adapter?.name ?? "generic",
    storeProductId: match?.value ?? null,
    storeProductIdSource: match?.source ?? "none"
  };
}

function extractAmazonAsin(url: URL): StoreProductIdMatch | null {
  const value = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i)?.[1];
  return value ? { value: value.toUpperCase(), source: "path:amazon-asin" } : null;
}

function extractMercadoLivreItem(url: URL): StoreProductIdMatch | null {
  const value = url.pathname.match(/\bMLB-?(\d{6,})\b/i)?.[1];
  return value ? { value: `MLB${value}`, source: "path:mercado-livre-item" } : null;
}

function extractShopeeItem(url: URL): StoreProductIdMatch | null {
  const match =
    url.pathname.match(/\/product\/(\d+)\/(\d+)(?:\/|$)/i) ??
    url.pathname.match(/-i\.(\d+)\.(\d+)(?:\b|$)/i);
  return match?.[1] && match[2]
    ? { value: `${match[1]}:${match[2]}`, source: "path:shopee-item" }
    : null;
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

function extractFirstQueryParam(
  url: URL,
  params: readonly QueryIdParam[]
): StoreProductIdMatch | null {
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
