export type PaymentMethod = "pix" | "cash" | "installment" | "unknown";

export type ProductCondition = "new" | "used" | "open_box" | "unknown";

export type GpuVendor = "NVIDIA" | "AMD";

export type StoreProductIdSource =
  | "path:amazon-asin"
  | "path:mercado-livre-item"
  | "path:shopee-item"
  | "query:sku"
  | "query:productId"
  | "query:produtoId"
  | "query:itemId"
  | "query:id"
  | "path:numeric-id"
  | "none";

export interface ParsedPrice {
  amountInCents: number;
  currency: "BRL";
  paymentMethod: PaymentMethod;
  rawText: string;
}

export interface NormalizedUrl {
  originalUrl: string;
  normalizedUrl: string;
  domain: string;
  path: string;
  removedTrackingParams: string[];
}

export interface NormalizedStore {
  domain: string;
  adapterName: string;
  storeProductId: string | null;
  storeProductIdSource: StoreProductIdSource;
}

export interface StoreAdapter {
  name: string;
  domain: string;
}

export interface NormalizeStoreInput {
  normalizedUrl?: NormalizedUrl | null;
  storeDomain?: string;
}

export interface CanonicalGpuProduct {
  id: string;
  vendor: GpuVendor;
  model: string;
  vramGb?: number | null;
}

export interface PriceQuote {
  method: PaymentMethod;
  amountInCents: number;
  installments: number | null;
  totalInCents: number;
  rawText: string;
}

export interface BuildOfferCandidateInput {
  rawText: string;
  capturedAt: Date | string;
  url?: string;
  urls?: string[];
  rawMessageId?: string;
  sourceName?: string;
  storeDomain?: string;
  resolvedUrl?: string | null;
  urlResolutionFailed?: boolean;
}

export interface OfferCandidate {
  rawText: string;
  capturedAt: string;
  sourceUrls: string[];
  sourceUrl: string | null;
  normalizedUrl: NormalizedUrl | null;
  store: NormalizedStore | null;
  storeProductId: string | null;
  domain: string | null;
  product: CanonicalGpuProduct | null;
  price: ParsedPrice | null;
  prices: PriceQuote[];
  effectivePrice: PriceQuote | null;
  priceBucketInCents: number | null;
  condition: ProductCondition;
  boardBrand: string | null;
  coupon: string | null;
  parserVersion: 2 | 3;
  urlResolutionFailed?: boolean;
  rawMessageId?: string;
  sourceName?: string;
  storeDomain?: string;
}

export interface ConsolidatedOffer {
  id: string;
  product: CanonicalGpuProduct;
  price: ParsedPrice;
  priceBucketInCents: number;
  normalizedUrl: string | null;
  store: NormalizedStore;
  storeProductId: string | null;
  domain: string;
  firstSeenAt: string;
  lastSeenAt: string;
  mentionCount: number;
  coupon?: string | null;
  observedPricesInCents?: number[];
  storeReliability?: number;
}

export interface OfferMention {
  rawMessageId: string | null;
  rawText: string;
  sourceName: string | null;
  capturedAt: string;
  offerId: string;
  candidate: OfferCandidate;
}

export interface DeduplicationResult {
  offers: ConsolidatedOffer[];
  offerMentions: OfferMention[];
}

export interface DeduplicationOptions {
  windowMs?: number;
}

export type OfferScoreLabel = "normal" | "boa" | "muito_boa" | "excepcional";

export interface PriceSnapshot {
  offerId: string;
  productId: string;
  observedAt: string;
  amountInCents: number;
  domain: string;
  storeProductId: string | null;
  mentionCount: number;
}

export interface PriceHistoryMetrics {
  lowestPriceIn7dInCents: number | null;
  lowestPriceIn30dInCents: number | null;
  lowestPriceIn90dInCents: number | null;
  medianPriceIn30dInCents: number | null;
  deviationFromMedian30dPercent: number | null;
  snapshotCount7d: number;
  snapshotCount30d: number;
  snapshotCount90d: number;
  usedSnapshotOfferIds7d: string[];
  usedSnapshotOfferIds30d: string[];
  usedSnapshotOfferIds90d: string[];
}

export interface PriceScoringPolicy {
  version: "offline-price-history-v1";
  windowsDays: {
    lowestPrice7d: number;
    lowestPrice30d: number;
    lowestPrice90d: number;
    median30d: number;
  };
  minimumSnapshotsIn30d: number;
  thresholds: {
    boa: number;
    muito_boa: number;
    excepcional: number;
  };
}

export interface ScoredOfferAudit {
  scoredAt: string;
  comparedSnapshotOfferIds7d: string[];
  comparedSnapshotOfferIds30d: string[];
  comparedSnapshotOfferIds90d: string[];
}

export interface ScoredOffer {
  offer: ConsolidatedOffer;
  label: OfferScoreLabel;
  qualityScore: number;
  confidence: "low" | "medium" | "high";
  metrics: PriceHistoryMetrics;
  reasons: string[];
  audit: ScoredOfferAudit;
}

export interface PriceScoringOutput {
  scoringPolicy: PriceScoringPolicy;
  priceSnapshots: PriceSnapshot[];
  scoredOffers: ScoredOffer[];
}
