import { z } from "zod";

export const importMessageSchema = z.object({
  externalId: z.string().trim().min(1).max(255).optional(),
  text: z.string().min(1).max(10_000),
  capturedAt: z.iso.datetime({ offset: true }),
  url: z.url().optional(),
  storeDomain: z.string().trim().min(1).max(255).optional(),
  storeProductId: z.string().trim().min(1).max(255).optional()
});

export const importBatchSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["manual", "import"])
  }),
  notifyEligible: z.boolean().default(false),
  messages: z.array(importMessageSchema).min(1).max(1_000)
});

export type ImportMessage = z.infer<typeof importMessageSchema>;
export type ImportBatch = z.infer<typeof importBatchSchema>;
