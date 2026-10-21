import { calculatePriceBucket } from "./price-bucket.js";
import type { CanonicalGpuProduct, OfferCandidate } from "./types.js";

/** Manual corrections from the admin, applied on every (re)parse of a message. */
export interface AdminOverrides {
  productKey?: string;
  priceInCents?: number;
  coupon?: string | null;
  storeProductId?: string | null;
  notAnOffer?: boolean;
}

export type ParseAdminOverridesResult =
  { ok: true; overrides: AdminOverrides } | { ok: false; error: string };

const VALIDATORS: Record<keyof AdminOverrides, (value: unknown) => boolean> = {
  productKey: (value) => typeof value === "string" && value.trim().length > 0,
  priceInCents: (value) => Number.isSafeInteger(value) && (value as number) > 0,
  coupon: (value) => value === null || (typeof value === "string" && value.trim().length > 0),
  storeProductId: (value) =>
    value === null || (typeof value === "string" && value.trim().length > 0),
  notAnOffer: (value) => typeof value === "boolean"
};

export function parseAdminOverrides(value: unknown): ParseAdminOverridesResult {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { ok: false, error: "invalid_overrides" };
  const overrides: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const validate = VALIDATORS[key as keyof AdminOverrides];
    if (!validate) return { ok: false, error: `unsupported_field:${key}` };
    if (!validate(field)) return { ok: false, error: `invalid_value:${key}` };
    overrides[key] = typeof field === "string" ? field.trim() : field;
  }
  return { ok: true, overrides: overrides as AdminOverrides };
}

/**
 * Applies admin corrections to a parsed candidate. `product` is the product resolved from
 * `overrides.productKey`; a product correction without it is ignored.
 */
export function applyAdminOverrides(
  candidate: OfferCandidate,
  overrides: AdminOverrides,
  product?: CanonicalGpuProduct | null
): OfferCandidate {
  const corrected: OfferCandidate = { ...candidate };
  if (overrides.productKey !== undefined && product) corrected.product = product;
  if (overrides.notAnOffer === true) corrected.product = null;
  if (overrides.priceInCents !== undefined) {
    corrected.price = {
      amountInCents: overrides.priceInCents,
      currency: "BRL",
      paymentMethod: candidate.price?.paymentMethod ?? "unknown",
      rawText: "admin_override"
    };
    corrected.priceBucketInCents = calculatePriceBucket(overrides.priceInCents);
  }
  if (overrides.coupon !== undefined) corrected.coupon = overrides.coupon;
  if (overrides.storeProductId !== undefined) {
    corrected.storeProductId = overrides.storeProductId;
    if (candidate.store)
      corrected.store = { ...candidate.store, storeProductId: overrides.storeProductId };
  }
  return corrected;
}
