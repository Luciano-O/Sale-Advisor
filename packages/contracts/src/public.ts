import { z } from "zod";

export const offerScoreLabelSchema = z.enum(["normal", "boa", "muito_boa", "excepcional"]);

export const offerSortSchema = z.enum(["recent", "discount"]);

export const offerCursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: offerSortSchema.default("recent"),
  category: z.literal("GPU").optional(),
  minimumLabel: offerScoreLabelSchema.optional()
});

/** How today's price compares with the product's history; null when it is insufficient. */
export interface OfferHistory {
  median30dInCents: number | null;
  lowest90dInCents: number | null;
  /** Positive when the price is under the 30-day median ("11% abaixo da mediana"). */
  discountVsMedianPercent: number | null;
}

const centsSchema = z.number().int().positive().nullable().catch(null);
const percentSchema = z.number().finite().nullable().catch(null);
const scoreMetricsSchema = z
  .object({
    medianPriceIn30dInCents: centsSchema.default(null),
    lowestPriceIn90dInCents: centsSchema.default(null),
    deviationFromMedian30dPercent: percentSchema.default(null)
  })
  .catch({
    medianPriceIn30dInCents: null,
    lowestPriceIn90dInCents: null,
    deviationFromMedian30dPercent: null
  });

/** Reads the public history from the stored score metrics, which are not validated on read. */
export function offerHistoryFromMetrics(metrics: unknown): OfferHistory {
  const parsed = scoreMetricsSchema.parse(metrics);
  const deviation = parsed.deviationFromMedian30dPercent;
  return {
    median30dInCents: parsed.medianPriceIn30dInCents,
    lowest90dInCents: parsed.lowestPriceIn90dInCents,
    // 0 - deviation keeps a price equal to the median at 0 instead of -0.
    discountVsMedianPercent: deviation === null ? null : 0 - deviation
  };
}

export const installationSchema = z.object({
  id: z.uuid(),
  platform: z.enum(["android", "ios"]),
  appVersion: z.string().trim().min(1).max(50)
});

export const anonymousEventNameSchema = z.enum([
  "app_opened",
  "feed_refreshed",
  "offer_viewed",
  "offer_clicked",
  "notification_received",
  "notification_opened",
  "product_followed",
  "product_hidden",
  "store_blocked"
]);

export const anonymousEventBatchSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.uuid(),
        installationId: z.uuid(),
        name: anonymousEventNameSchema,
        occurredAt: z.iso.datetime({ offset: true }),
        payload: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .optional()
      })
    )
    .min(1)
    .max(100)
});

export type OfferCursor = z.infer<typeof offerCursorSchema>;
export type OfferSort = z.infer<typeof offerSortSchema>;
export type AnonymousEventBatch = z.infer<typeof anonymousEventBatchSchema>;
