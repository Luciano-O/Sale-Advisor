import { describe, expect, it } from "vitest";

import { calculatePriceBucket } from "./price-bucket.js";

describe("calculatePriceBucket", () => {
  it("groups prices by BRL 50 using floor", () => {
    expect(calculatePriceBucket(199990)).toBe(195000);
  });

  it("keeps exact BRL 50 boundaries in the same bucket", () => {
    expect(calculatePriceBucket(200000)).toBe(200000);
  });
});
