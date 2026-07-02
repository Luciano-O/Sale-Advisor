export type PaymentMethod = "pix" | "cash" | "installment" | "unknown";

export type ProductCondition = "new" | "used" | "open_box" | "unknown";

export type GpuVendor = "NVIDIA" | "AMD";

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

export interface CanonicalGpuProduct {
  id: string;
  vendor: GpuVendor;
  model: string;
}

export interface BuildOfferCandidateInput {
  rawText: string;
  capturedAt: Date | string;
  url?: string;
}

export interface OfferCandidate {
  rawText: string;
  capturedAt: string;
  sourceUrl: string | null;
  normalizedUrl: NormalizedUrl | null;
  product: CanonicalGpuProduct | null;
  price: ParsedPrice | null;
  priceBucketInCents: number | null;
  condition: ProductCondition;
}
