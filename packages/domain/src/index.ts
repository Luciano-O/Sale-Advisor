export { deduplicateOfferCandidates } from "./deduplication.js";
export { identifyGpuProduct } from "./gpu.js";
export { buildOfferCandidate } from "./offer-candidate.js";
export { calculatePriceBucket } from "./price-bucket.js";
export { parsePrice } from "./price.js";
export { normalizeUrl } from "./url.js";
export type {
  BuildOfferCandidateInput,
  CanonicalGpuProduct,
  ConsolidatedOffer,
  DeduplicationOptions,
  DeduplicationResult,
  GpuVendor,
  NormalizedUrl,
  OfferCandidate,
  OfferMention,
  ParsedPrice,
  PaymentMethod,
  ProductCondition
} from "./types.js";
