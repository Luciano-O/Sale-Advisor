import type {
  ConsolidatedOffer,
  OfferScoreLabel,
  PriceHistoryMetrics,
  PriceScoringOutput,
  PriceScoringPolicy,
  PriceSnapshot,
  ScoredOffer
} from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PRICE_SCORING_POLICY: PriceScoringPolicy = {
  version: "offline-price-history-v1",
  windowsDays: {
    lowestPrice7d: 7,
    lowestPrice30d: 30,
    lowestPrice90d: 90,
    median30d: 30
  },
  minimumSnapshotsIn30d: 3,
  thresholds: {
    boa: 5,
    muito_boa: 10,
    excepcional: 15
  }
};

export interface ScoreOptions {
  scoringPolicy?: PriceScoringPolicy;
}

export function createPriceSnapshots(offers: ConsolidatedOffer[]): PriceSnapshot[] {
  return offers
    .map((offer) => ({
      offerId: offer.id,
      productId: offer.product.id,
      observedAt: new Date(offer.firstSeenAt).toISOString(),
      amountInCents: offer.price.amountInCents,
      domain: offer.domain,
      storeProductId: offer.storeProductId,
      mentionCount: offer.mentionCount
    }))
    .sort(compareSnapshots);
}

export function calculatePriceHistoryMetrics(
  offer: ConsolidatedOffer,
  snapshots: PriceSnapshot[],
  options: ScoreOptions = {}
): PriceHistoryMetrics {
  const scoringPolicy = options.scoringPolicy ?? DEFAULT_PRICE_SCORING_POLICY;
  const snapshots7d = selectPreviousSnapshots(offer, snapshots, scoringPolicy.windowsDays.lowestPrice7d);
  const snapshots30d = selectPreviousSnapshots(offer, snapshots, scoringPolicy.windowsDays.lowestPrice30d);
  const snapshots90d = selectPreviousSnapshots(offer, snapshots, scoringPolicy.windowsDays.lowestPrice90d);
  const medianPriceIn30dInCents = calculateMedian(snapshots30d.map((snapshot) => snapshot.amountInCents));

  return {
    lowestPriceIn7dInCents: calculateLowestPrice(snapshots7d),
    lowestPriceIn30dInCents: calculateLowestPrice(snapshots30d),
    lowestPriceIn90dInCents: calculateLowestPrice(snapshots90d),
    medianPriceIn30dInCents,
    deviationFromMedian30dPercent: calculateDeviationPercent(offer.price.amountInCents, medianPriceIn30dInCents),
    snapshotCount7d: snapshots7d.length,
    snapshotCount30d: snapshots30d.length,
    snapshotCount90d: snapshots90d.length,
    usedSnapshotOfferIds7d: snapshots7d.map((snapshot) => snapshot.offerId),
    usedSnapshotOfferIds30d: snapshots30d.map((snapshot) => snapshot.offerId),
    usedSnapshotOfferIds90d: snapshots90d.map((snapshot) => snapshot.offerId)
  };
}

export function scoreOffer(offer: ConsolidatedOffer, snapshots: PriceSnapshot[], options: ScoreOptions = {}): ScoredOffer {
  const scoringPolicy = options.scoringPolicy ?? DEFAULT_PRICE_SCORING_POLICY;
  const metrics = calculatePriceHistoryMetrics(offer, snapshots, { scoringPolicy });
  const { label, reasons } = classifyOffer(offer, metrics, scoringPolicy);

  return {
    offer,
    label,
    metrics,
    reasons,
    audit: {
      scoredAt: new Date(offer.firstSeenAt).toISOString(),
      comparedSnapshotOfferIds7d: metrics.usedSnapshotOfferIds7d,
      comparedSnapshotOfferIds30d: metrics.usedSnapshotOfferIds30d,
      comparedSnapshotOfferIds90d: metrics.usedSnapshotOfferIds90d
    }
  };
}

export function scoreOffersWithPriceHistory(offers: ConsolidatedOffer[], options: ScoreOptions = {}): PriceScoringOutput {
  const scoringPolicy = options.scoringPolicy ?? DEFAULT_PRICE_SCORING_POLICY;
  const sortedOffers = [...offers].sort(compareOffers);
  const priceSnapshots = createPriceSnapshots(sortedOffers);

  return {
    scoringPolicy,
    priceSnapshots,
    scoredOffers: sortedOffers.map((offer) => scoreOffer(offer, priceSnapshots, { scoringPolicy }))
  };
}

function classifyOffer(
  offer: ConsolidatedOffer,
  metrics: PriceHistoryMetrics,
  scoringPolicy: PriceScoringPolicy
): { label: OfferScoreLabel; reasons: string[] } {
  if (metrics.snapshotCount30d < scoringPolicy.minimumSnapshotsIn30d || metrics.medianPriceIn30dInCents === null) {
    return {
      label: "normal",
      reasons: ["insufficient_history"]
    };
  }

  const discountPercent = ((metrics.medianPriceIn30dInCents - offer.price.amountInCents) / metrics.medianPriceIn30dInCents) * 100;
  const reasons: string[] = [];
  let label: OfferScoreLabel = "normal";

  if (discountPercent >= scoringPolicy.thresholds.excepcional) {
    label = "excepcional";
    reasons.push("median_discount_at_least_15_percent");
  } else if (discountPercent >= scoringPolicy.thresholds.muito_boa) {
    label = "muito_boa";
    reasons.push("median_discount_at_least_10_percent");
  } else if (discountPercent >= scoringPolicy.thresholds.boa) {
    label = "boa";
    reasons.push("median_discount_at_least_5_percent");
  } else {
    reasons.push("median_discount_below_5_percent");
  }

  if (isCurrentLowest(offer, metrics.lowestPriceIn7dInCents)) {
    reasons.push("lowest_price_7d");
  }

  if (isCurrentLowest(offer, metrics.lowestPriceIn30dInCents)) {
    reasons.push("lowest_price_30d");
  }

  if (isCurrentLowest(offer, metrics.lowestPriceIn90dInCents)) {
    reasons.push("lowest_price_90d");
  }

  return { label, reasons };
}

function selectPreviousSnapshots(offer: ConsolidatedOffer, snapshots: PriceSnapshot[], windowDays: number): PriceSnapshot[] {
  const scoreTime = Date.parse(offer.firstSeenAt);
  const windowMs = windowDays * DAY_MS;

  return snapshots
    .filter((snapshot) => {
      const observedAt = Date.parse(snapshot.observedAt);

      return (
        snapshot.productId === offer.product.id &&
        snapshot.offerId !== offer.id &&
        observedAt < scoreTime &&
        scoreTime - observedAt <= windowMs
      );
    })
    .sort(compareSnapshots);
}

function calculateLowestPrice(snapshots: PriceSnapshot[]): number | null {
  if (snapshots.length === 0) {
    return null;
  }

  return Math.min(...snapshots.map((snapshot) => snapshot.amountInCents));
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle] ?? null;
  }

  const left = sortedValues[middle - 1];
  const right = sortedValues[middle];

  if (left === undefined || right === undefined) {
    return null;
  }

  return Math.round((left + right) / 2);
}

function calculateDeviationPercent(amountInCents: number, medianInCents: number | null): number | null {
  if (medianInCents === null || medianInCents === 0) {
    return null;
  }

  return roundPercent(((amountInCents - medianInCents) / medianInCents) * 100);
}

function isCurrentLowest(offer: ConsolidatedOffer, lowestPriceInCents: number | null): boolean {
  return lowestPriceInCents !== null && offer.price.amountInCents <= lowestPriceInCents;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareOffers(left: ConsolidatedOffer, right: ConsolidatedOffer): number {
  const byFirstSeenAt = new Date(left.firstSeenAt).toISOString().localeCompare(new Date(right.firstSeenAt).toISOString());

  if (byFirstSeenAt !== 0) {
    return byFirstSeenAt;
  }

  return left.id.localeCompare(right.id);
}

function compareSnapshots(left: PriceSnapshot, right: PriceSnapshot): number {
  const byObservedAt = left.observedAt.localeCompare(right.observedAt);

  if (byObservedAt !== 0) {
    return byObservedAt;
  }

  return left.offerId.localeCompare(right.offerId);
}
