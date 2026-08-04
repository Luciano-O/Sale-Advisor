import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as schema from "./schema.js";
import { GPU_TAXONOMY_SEED } from "./taxonomy.js";

describe("persistent MVP schema", () => {
  it("exports every required audit-safe table", () => {
    const names = Object.values(schema)
      .filter(
        (value): value is Parameters<typeof getTableName>[0] =>
          typeof value === "object" &&
          value !== null &&
          Symbol.for("drizzle:IsDrizzleTable") in value
      )
      .map(getTableName)
      .sort();

    expect(names).toEqual([
      "admin_audit_events",
      "anonymous_events",
      "collector_instances",
      "device_installations",
      "import_batches",
      "notification_deliveries",
      "notification_subscriptions",
      "offer_mentions",
      "offer_scores",
      "offers",
      "outbox_events",
      "price_snapshots",
      "product_aliases",
      "products",
      "raw_message_parses",
      "raw_messages",
      "sources",
      "stores",
      "url_resolutions"
    ]);
  });

  it("contains the controlled GPU taxonomy without duplicate ids", () => {
    expect(GPU_TAXONOMY_SEED).toHaveLength(9);
    expect(new Set(GPU_TAXONOMY_SEED.map((product) => product.id)).size).toBe(9);
    expect(GPU_TAXONOMY_SEED).toContainEqual(
      expect.objectContaining({ vendor: "NVIDIA", model: "RTX 4060", vramGb: 8 })
    );
  });
});
