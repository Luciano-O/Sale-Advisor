import { z } from "zod";

export const offerScoreLabelSchema = z.enum(["normal", "boa", "muito_boa", "excepcional"]);

export const offerCursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.literal("GPU").optional(),
  minimumLabel: offerScoreLabelSchema.optional()
});

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
export type AnonymousEventBatch = z.infer<typeof anonymousEventBatchSchema>;
