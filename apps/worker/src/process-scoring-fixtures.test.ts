import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { CanonicalGpuProduct, ConsolidatedOffer } from "@sale-advisor/domain";
import { processScoringFixtureFile, scoreConsolidatedOffers } from "./process-scoring-fixtures.js";

describe("scoreConsolidatedOffers", () => {
  it("turns consolidated offers into auditable scored offers", () => {
    const result = scoreConsolidatedOffers([
      offer({ id: "current", firstSeenAt: "2026-07-10T10:00:00.000Z", amountInCents: 180000 }),
      offer({ id: "history-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "history-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "history-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 200000 })
    ]);

    expect(result.scoringPolicy.version).toBe("offline-price-history-v1");
    expect(result.priceSnapshots.map((snapshot) => snapshot.offerId)).toEqual([
      "history-1",
      "history-2",
      "history-3",
      "current"
    ]);
    expect(result.scoredOffers.find((scoredOffer) => scoredOffer.offer.id === "current")).toMatchObject({
      label: "muito_boa",
      offer: {
        id: "current",
        product: {
          id: "nvidia-rtx-4060"
        },
        price: {
          amountInCents: 180000
        }
      }
    });
  });

  it("is deterministic for the same consolidated offers", () => {
    const offers = [
      offer({ id: "current", firstSeenAt: "2026-07-10T10:00:00.000Z", amountInCents: 170000 }),
      offer({ id: "history-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "history-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200000 }),
      offer({ id: "history-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 200000 })
    ];

    expect(scoreConsolidatedOffers(offers)).toEqual(scoreConsolidatedOffers(offers));
  });
});

describe("processScoringFixtureFile", () => {
  it("reads consolidated-offers fixture and writes scored-offers output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sale-advisor-scoring-"));
    const inputPath = join(directory, "consolidated-offers.json");
    const outputPath = join(directory, "scored-offers.json");

    await writeFile(
      inputPath,
      `${JSON.stringify(
        {
          offers: [
            offer({ id: "current", firstSeenAt: "2026-07-10T10:00:00.000Z", amountInCents: 170000 }),
            offer({ id: "history-1", firstSeenAt: "2026-07-01T10:00:00.000Z", amountInCents: 200000 }),
            offer({ id: "history-2", firstSeenAt: "2026-07-02T10:00:00.000Z", amountInCents: 200000 }),
            offer({ id: "history-3", firstSeenAt: "2026-07-03T10:00:00.000Z", amountInCents: 200000 })
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await processScoringFixtureFile({ inputPath, outputPath });
    const written = JSON.parse(await readFile(outputPath, "utf8")) as unknown;

    expect(written).toEqual(result);
    expect(result.scoredOffers.find((scoredOffer) => scoredOffer.offer.id === "current")?.label).toBe("excepcional");
  });

  it("rejects invalid consolidated offer fixtures with a clear error", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sale-advisor-scoring-invalid-"));
    const inputPath = join(directory, "consolidated-offers.json");

    await writeFile(inputPath, `${JSON.stringify({ offers: [{ id: "missing-fields" }] })}\n`, "utf8");

    await expect(processScoringFixtureFile({ inputPath })).rejects.toThrow(
      "consolidated offer at index 0 must include product, price, store and timestamps"
    );
  });
});

function offer(overrides: {
  id: string;
  firstSeenAt: string;
  amountInCents: number;
  product?: CanonicalGpuProduct;
}): ConsolidatedOffer {
  return {
    id: overrides.id,
    product: overrides.product ?? {
      id: "nvidia-rtx-4060",
      vendor: "NVIDIA",
      model: "RTX 4060"
    },
    price: {
      amountInCents: overrides.amountInCents,
      currency: "BRL",
      paymentMethod: "pix",
      rawText: `R$ ${(overrides.amountInCents / 100).toFixed(2)}`
    },
    priceBucketInCents: overrides.amountInCents,
    normalizedUrl: `https://shop.test/${overrides.id}`,
    store: {
      domain: "shop.test",
      adapterName: "shop",
      storeProductId: "SKU-1",
      storeProductIdSource: "query:sku"
    },
    storeProductId: "SKU-1",
    domain: "shop.test",
    firstSeenAt: overrides.firstSeenAt,
    lastSeenAt: overrides.firstSeenAt,
    mentionCount: 1
  };
}
