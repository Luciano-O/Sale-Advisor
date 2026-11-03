import type {
  NormalizedStore,
  NormalizeStoreInput,
  StoreIdentity,
  StoreProductIdSource
} from "./types.js";

// Mirrored by the 0005_store_identity migration, which names the stores that already exist.
export const KNOWN_STORES: readonly StoreIdentity[] = [
  { domain: "amazon.com.br", name: "Amazon" },
  { domain: "mercadolivre.com.br", name: "Mercado Livre" },
  { domain: "shopee.com.br", name: "Shopee" },
  { domain: "kabum.com.br", name: "KaBuM!" },
  { domain: "terabyteshop.com.br", name: "Terabyte" },
  { domain: "pichau.com.br", name: "Pichau" },
  { domain: "magazineluiza.com.br", name: "Magazine Luiza" },
  { domain: "aliexpress.com", name: "AliExpress" },
  { domain: "patoloco.com.br", name: "Pato Loco" }
];

// Dead affiliate links redirect here; nothing can be bought on these sites.
const NON_STORE_DOMAINS = new Set(["aceleraafiliado.com"]);

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
    name: "kabum",
    matchesDomain: (domain) => domain === "kabum.com.br",
    extractStoreProductId: (url) => extractProductPathId(url, "path:kabum-product")
  },
  {
    name: "terabyte",
    matchesDomain: (domain) => domain === "terabyteshop.com.br",
    extractStoreProductId: (url) => extractProductPathId(url, "path:terabyte-product")
  },
  {
    name: "magazine-luiza",
    matchesDomain: (domain) => domain === "magazineluiza.com.br",
    extractStoreProductId: extractMagazineLuizaSku
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
  const { domain } = identifyStore(input.normalizedUrl?.domain ?? input.storeDomain ?? "");
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

/** A subdomain (live., m., produto.) is the store itself; an unknown store goes by its domain. */
export function identifyStore(domain: string): StoreIdentity {
  const normalized = normalizeDomain(domain);
  return (
    KNOWN_STORES.find(
      (store) => normalized === store.domain || normalized.endsWith(`.${store.domain}`)
    ) ?? { domain: normalized, name: normalized }
  );
}

export function isNonStoreDomain(domain: string): boolean {
  return NON_STORE_DOMAINS.has(normalizeDomain(domain));
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

function extractProductPathId(
  url: URL,
  source: "path:kabum-product" | "path:terabyte-product"
): StoreProductIdMatch | null {
  const value = url.pathname.match(/^\/produto\/(\d+)(?:\/|$)/i)?.[1];
  return value ? { value, source } : null;
}

// Product pages use /p/<sku>/; affiliate links use /divulgador/oferta/<sku>/.
function extractMagazineLuizaSku(url: URL): StoreProductIdMatch | null {
  const value = url.pathname.match(/\/(?:p|divulgador\/oferta)\/([a-z0-9]{8,12})(?:\/|$)/i)?.[1];
  return value ? { value: value.toLowerCase(), source: "path:magazine-luiza-sku" } : null;
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
