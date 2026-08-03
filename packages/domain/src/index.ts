export { deduplicateOfferCandidates } from "./deduplication.js";
export { identifyGpuProduct } from "./gpu.js";
export { buildOfferCandidate } from "./offer-candidate.js";
export { calculatePriceBucket } from "./price-bucket.js";
export { parsePrice, parsePriceQuotes, selectEffectivePrice } from "./price.js";
export {
  DEFAULT_PRICE_SCORING_POLICY,
  calculatePriceHistoryMetrics,
  createPriceSnapshots,
  scoreOffer,
  scoreOffersWithPriceHistory
} from "./price-history.js";
export { normalizeStore, normalizeStoreDomain } from "./store.js";
export { extractHttpUrls, normalizeUrl, selectPrimaryOfferUrl } from "./url.js";
export type {
  BuildOfferCandidateInput,
  CanonicalGpuProduct,
  ConsolidatedOffer,
  DeduplicationOptions,
  DeduplicationResult,
  GpuVendor,
  NormalizedStore,
  NormalizedUrl,
  NormalizeStoreInput,
  OfferCandidate,
  OfferMention,
  ParsedPrice,
  PriceQuote,
  PriceHistoryMetrics,
  PriceScoringOutput,
  PriceScoringPolicy,
  PriceSnapshot,
  OfferScoreLabel,
  PaymentMethod,
  ProductCondition,
  ScoredOffer,
  ScoredOfferAudit,
  StoreAdapter,
  StoreProductIdSource
} from "./types.js";
