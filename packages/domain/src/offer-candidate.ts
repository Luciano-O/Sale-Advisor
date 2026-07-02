import { identifyGpuProduct } from "./gpu.js";
import { calculatePriceBucket } from "./price-bucket.js";
import { parsePrice } from "./price.js";
import type { BuildOfferCandidateInput, OfferCandidate } from "./types.js";
import { normalizeUrl } from "./url.js";

const URL_PATTERN = /https?:\/\/\S+/i;

export function buildOfferCandidate(input: BuildOfferCandidateInput): OfferCandidate {
  const sourceUrl = input.url ?? extractFirstUrl(input.rawText);
  const price = parsePrice(input.rawText);
  const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : null;
  const storeDomain = input.storeDomain ? normalizeDomain(input.storeDomain) : undefined;
  const domain = normalizedUrl?.domain ?? storeDomain ?? null;

  return {
    rawText: input.rawText,
    capturedAt: new Date(input.capturedAt).toISOString(),
    sourceUrl,
    normalizedUrl,
    domain,
    product: identifyGpuProduct(input.rawText),
    price,
    priceBucketInCents: price ? calculatePriceBucket(price.amountInCents) : null,
    condition: "unknown",
    ...(input.rawMessageId ? { rawMessageId: input.rawMessageId } : {}),
    ...(input.sourceName ? { sourceName: input.sourceName } : {}),
    ...(storeDomain ? { storeDomain } : {})
  };
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match?.[0] ?? null;
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}
