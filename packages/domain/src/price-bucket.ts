const PRICE_BUCKET_SIZE_IN_CENTS = 5000;

export function calculatePriceBucket(priceInCents: number): number {
  if (!Number.isFinite(priceInCents) || priceInCents < 0) {
    throw new RangeError("priceInCents must be a non-negative finite number");
  }

  return Math.floor(priceInCents / PRICE_BUCKET_SIZE_IN_CENTS) * PRICE_BUCKET_SIZE_IN_CENTS;
}
