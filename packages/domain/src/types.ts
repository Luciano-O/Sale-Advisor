export type PaymentMethod = "pix" | "cash" | "installment" | "unknown";

export type ProductCondition = "new" | "used" | "open_box" | "unknown";

export type GpuVendor = "NVIDIA" | "AMD";

export type StoreProductIdSource =
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
}

export interface BuildOfferCandidateInput {
  rawText: string;
  capturedAt: Date | string;
  url?: string;
  rawMessageId?: string;
  sourceName?: string;
  storeDomain?: string;
}

export interface OfferCandidate {
  rawText: string;
  capturedAt: string;
  sourceUrl: string | null;
  normalizedUrl: NormalizedUrl | null;
  store: NormalizedStore | null;
  storeProductId: string | null;
  domain: string | null;
  product: CanonicalGpuProduct | null;
  price: ParsedPrice | null;
  priceBucketInCents: number | null;
  condition: ProductCondition;
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
