import { identifyGpuProduct } from "./gpu.js";
import { calculatePriceBucket } from "./price-bucket.js";
import { parsePriceQuotes, selectEffectivePrice } from "./price.js";
import { normalizeStore, normalizeStoreDomain } from "./store.js";
import type { BuildOfferCandidateInput, OfferCandidate } from "./types.js";
import { extractHttpUrls, normalizeUrl, selectPrimaryOfferUrl } from "./url.js";

export function buildOfferCandidate(input: BuildOfferCandidateInput): OfferCandidate {
  const sourceUrls = Array.from(
    new Set([
      ...(input.url ? [input.url] : []),
      ...(input.urls ?? []),
      ...extractHttpUrls(input.rawText)
    ])
  );
  const sourceUrl = input.urlResolutionFailed
    ? null
    : input.resolvedUrl !== undefined
      ? input.resolvedUrl
      : selectPrimaryOfferUrl(sourceUrls);
  const prices = parsePriceQuotes(input.rawText);
  const effectivePrice = selectEffectivePrice(prices);
  const price = effectivePrice
    ? {
        amountInCents: effectivePrice.totalInCents,
        currency: "BRL" as const,
        paymentMethod: effectivePrice.method,
        rawText: effectivePrice.rawText
      }
    : null;
  const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : null;
  const storeDomain = input.storeDomain ? normalizeStoreDomain(input.storeDomain) : undefined;
  const store =
    normalizedUrl || storeDomain
      ? normalizeStore({ normalizedUrl, ...(storeDomain ? { storeDomain } : {}) })
      : null;
  const domain = store?.domain ?? null;

  return {
    rawText: input.rawText,
    capturedAt: new Date(input.capturedAt).toISOString(),
    sourceUrls,
    sourceUrl,
    normalizedUrl,
    store,
    storeProductId: store?.storeProductId ?? null,
    domain,
    product: identifyGpuProduct(input.rawText),
    price,
    prices,
    effectivePrice,
    priceBucketInCents: price ? calculatePriceBucket(price.amountInCents) : null,
    condition: extractCondition(input.rawText),
    boardBrand: extractBoardBrand(input.rawText),
    coupon: extractCoupon(input.rawText),
    parserVersion: 3,
    urlResolutionFailed: input.urlResolutionFailed ?? false,
    ...(input.rawMessageId ? { rawMessageId: input.rawMessageId } : {}),
    ...(input.sourceName ? { sourceName: input.sourceName } : {}),
    ...(storeDomain ? { storeDomain } : {})
  };
}

function extractCondition(text: string): OfferCandidate["condition"] {
  if (/\b(?:open[ -]?box|caixa aberta)\b/i.test(text)) return "open_box";
  if (/\b(?:usad[oa]|seminov[oa])\b/i.test(text)) return "used";
  if (/\b(?:nov[oa]|lacrad[oa])\b/i.test(text)) return "new";
  return "unknown";
}

function extractBoardBrand(text: string): string | null {
  return (
    ["ASUS", "MSI", "GIGABYTE", "GALAX", "ZOTAC", "SAPPHIRE", "XFX", "ASROCK", "PNY"].find(
      (brand) => new RegExp(`\\b${brand}\\b`, "i").test(text)
    ) ?? null
  );
}

function extractCoupon(text: string): string | null {
  return text.match(/\bcupom\s*[:=-]?\s*([a-z0-9_-]{2,32})\b/i)?.[1]?.toUpperCase() ?? null;
}
