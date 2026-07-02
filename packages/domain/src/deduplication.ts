import type {
  ConsolidatedOffer,
  DeduplicationOptions,
  DeduplicationResult,
  OfferCandidate,
  OfferMention
} from "./types.js";

const DEFAULT_DEDUPLICATION_WINDOW_MS = 48 * 60 * 60 * 1000;

interface MutableOffer extends ConsolidatedOffer {}

export function deduplicateOfferCandidates(
  candidates: OfferCandidate[],
  options: DeduplicationOptions = {}
): DeduplicationResult {
  const windowMs = options.windowMs ?? DEFAULT_DEDUPLICATION_WINDOW_MS;
  const offers: MutableOffer[] = [];
  const offerMentions: OfferMention[] = [];

  for (const candidate of sortCandidates(candidates)) {
    if (!isCompleteCandidate(candidate)) {
      continue;
    }

    const offer = findMatchingOffer(offers, candidate, windowMs) ?? createOffer(candidate, offers.length + 1);

    if (!offers.includes(offer)) {
      offers.push(offer);
    }

    offer.lastSeenAt = maxIsoDate(offer.lastSeenAt, candidate.capturedAt);
    offer.mentionCount += 1;

    if (!offer.normalizedUrl && candidate.normalizedUrl) {
      offer.normalizedUrl = candidate.normalizedUrl.normalizedUrl;
    }

    offerMentions.push({
      rawMessageId: candidate.rawMessageId ?? null,
      rawText: candidate.rawText,
      sourceName: candidate.sourceName ?? null,
      capturedAt: candidate.capturedAt,
      offerId: offer.id,
      candidate
    });
  }

  return {
    offers,
    offerMentions
  };
}

function sortCandidates(candidates: OfferCandidate[]): OfferCandidate[] {
  return [...candidates].sort((left, right) => {
    const byCapturedAt = left.capturedAt.localeCompare(right.capturedAt);

    if (byCapturedAt !== 0) {
      return byCapturedAt;
    }

    const byRawMessageId = (left.rawMessageId ?? "").localeCompare(right.rawMessageId ?? "");

    if (byRawMessageId !== 0) {
      return byRawMessageId;
    }

    const bySourceName = (left.sourceName ?? "").localeCompare(right.sourceName ?? "");

    if (bySourceName !== 0) {
      return bySourceName;
    }

    return left.rawText.localeCompare(right.rawText);
  });
}

function isCompleteCandidate(candidate: OfferCandidate): candidate is OfferCandidate & {
  product: NonNullable<OfferCandidate["product"]>;
  price: NonNullable<OfferCandidate["price"]>;
  priceBucketInCents: number;
  domain: string;
} {
  return Boolean(candidate.product && candidate.price && candidate.priceBucketInCents !== null && candidate.domain);
}

function findMatchingOffer(offers: MutableOffer[], candidate: CompleteOfferCandidate, windowMs: number): MutableOffer | null {
  return (
    offers.find((offer) => isInsideWindow(offer, candidate, windowMs) && matchesByNormalizedUrl(offer, candidate)) ??
    offers.find((offer) => isInsideWindow(offer, candidate, windowMs) && matchesByFallbackSignals(offer, candidate)) ??
    null
  );
}

type CompleteOfferCandidate = OfferCandidate & {
  product: NonNullable<OfferCandidate["product"]>;
  price: NonNullable<OfferCandidate["price"]>;
  priceBucketInCents: number;
  domain: string;
};

function matchesByNormalizedUrl(offer: MutableOffer, candidate: CompleteOfferCandidate): boolean {
  return Boolean(
    offer.normalizedUrl &&
      candidate.normalizedUrl &&
      offer.normalizedUrl === candidate.normalizedUrl.normalizedUrl &&
      offer.product.id === candidate.product.id &&
      offer.price.amountInCents === candidate.price.amountInCents
  );
}

function matchesByFallbackSignals(offer: MutableOffer, candidate: CompleteOfferCandidate): boolean {
  return (
    offer.product.id === candidate.product.id &&
    offer.domain === candidate.domain &&
    offer.priceBucketInCents === candidate.priceBucketInCents &&
    offer.price.amountInCents === candidate.price.amountInCents
  );
}

function isInsideWindow(offer: MutableOffer, candidate: CompleteOfferCandidate, windowMs: number): boolean {
  const firstSeenAt = Date.parse(offer.firstSeenAt);
  const capturedAt = Date.parse(candidate.capturedAt);

  return capturedAt - firstSeenAt <= windowMs;
}

function createOffer(candidate: CompleteOfferCandidate, index: number): MutableOffer {
  return {
    id: `offer_${index.toString().padStart(4, "0")}`,
    product: candidate.product,
    price: candidate.price,
    priceBucketInCents: candidate.priceBucketInCents,
    normalizedUrl: candidate.normalizedUrl?.normalizedUrl ?? null,
    domain: candidate.domain,
    firstSeenAt: candidate.capturedAt,
    lastSeenAt: candidate.capturedAt,
    mentionCount: 0
  };
}

function maxIsoDate(left: string, right: string): string {
  return left.localeCompare(right) >= 0 ? left : right;
}
