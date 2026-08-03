import type {
  ConsolidatedOffer,
  DeduplicationOptions,
  DeduplicationResult,
  OfferCandidate,
  OfferMention
} from "./types.js";

const DEFAULT_DEDUPLICATION_WINDOW_MS = 48 * 60 * 60 * 1000;

type MutableOffer = ConsolidatedOffer;

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

    const offer =
      findMatchingOffer(offers, candidate, windowMs) ?? createOffer(candidate, offers.length + 1);

    if (!offers.includes(offer)) {
      offers.push(offer);
    }

    offer.lastSeenAt = maxIsoDate(offer.lastSeenAt, candidate.capturedAt);
    offer.mentionCount += 1;
    offer.price = candidate.price;
    offer.priceBucketInCents = candidate.priceBucketInCents;
    offer.coupon = candidate.coupon;
    const observedPrices = offer.observedPricesInCents ?? [];
    if (observedPrices.at(-1) !== candidate.price.amountInCents) {
      observedPrices.push(candidate.price.amountInCents);
    }
    offer.observedPricesInCents = observedPrices;

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

function isCompleteCandidate(candidate: OfferCandidate): candidate is CompleteOfferCandidate {
  return Boolean(
    candidate.product &&
    candidate.price &&
    candidate.priceBucketInCents !== null &&
    candidate.domain &&
    candidate.store
  );
}

type CompleteOfferCandidate = OfferCandidate & {
  product: NonNullable<OfferCandidate["product"]>;
  price: NonNullable<OfferCandidate["price"]>;
  priceBucketInCents: number;
  domain: string;
  store: NonNullable<OfferCandidate["store"]>;
};

function findMatchingOffer(
  offers: MutableOffer[],
  candidate: CompleteOfferCandidate,
  windowMs: number
): MutableOffer | null {
  return (
    offers.find(
      (offer) =>
        isInsideWindow(offer, candidate, windowMs) && matchesByStoreProductId(offer, candidate)
    ) ??
    offers.find(
      (offer) =>
        isInsideWindow(offer, candidate, windowMs) && matchesByNormalizedUrl(offer, candidate)
    ) ??
    offers.find(
      (offer) =>
        isInsideWindow(offer, candidate, windowMs) && matchesByFallbackSignals(offer, candidate)
    ) ??
    null
  );
}

function matchesByStoreProductId(offer: MutableOffer, candidate: CompleteOfferCandidate): boolean {
  return Boolean(
    offer.storeProductId &&
    candidate.storeProductId &&
    offer.domain === candidate.domain &&
    offer.storeProductId === candidate.storeProductId &&
    offer.product.id === candidate.product.id &&
    offer.price.amountInCents === candidate.price.amountInCents &&
    sameCoupon(offer.coupon, candidate.coupon)
  );
}

function matchesByNormalizedUrl(offer: MutableOffer, candidate: CompleteOfferCandidate): boolean {
  return Boolean(
    offer.normalizedUrl &&
    candidate.normalizedUrl &&
    offer.normalizedUrl === candidate.normalizedUrl.normalizedUrl &&
    offer.product.id === candidate.product.id &&
    offer.price.amountInCents === candidate.price.amountInCents &&
    sameCoupon(offer.coupon, candidate.coupon)
  );
}

function matchesByFallbackSignals(offer: MutableOffer, candidate: CompleteOfferCandidate): boolean {
  return (
    offer.product.id === candidate.product.id &&
    offer.domain === candidate.domain &&
    offer.priceBucketInCents === candidate.priceBucketInCents &&
    sameCoupon(offer.coupon, candidate.coupon)
  );
}

function isInsideWindow(
  offer: MutableOffer,
  candidate: CompleteOfferCandidate,
  windowMs: number
): boolean {
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
    store: candidate.store,
    storeProductId: candidate.storeProductId,
    domain: candidate.domain,
    firstSeenAt: candidate.capturedAt,
    lastSeenAt: candidate.capturedAt,
    mentionCount: 0,
    coupon: candidate.coupon,
    observedPricesInCents: []
  };
}

function sameCoupon(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

function maxIsoDate(left: string, right: string): string {
  return left.localeCompare(right) >= 0 ? left : right;
}
