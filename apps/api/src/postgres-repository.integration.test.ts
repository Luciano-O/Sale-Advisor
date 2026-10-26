import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresApiRepository } from "./postgres-repository.js";

const integration = process.env.RUN_API_INTEGRATION === "true";
const PRODUCT_KEY = "nvidia-integration-feed-gpu-8gb";
const STORE_DOMAIN = "integration-feed.example";

// Ties on label, quality score and first_seen_at exercise every column of the feed ordering.
const OFFERS = [
  { label: "excepcional", quality: 90, firstSeenAt: "2020-01-01T12:00:00Z" },
  { label: "boa", quality: 50, firstSeenAt: "2020-01-05T12:00:00Z" },
  { label: "boa", quality: 50, firstSeenAt: "2020-01-05T12:00:00Z" },
  { label: "boa", quality: 70, firstSeenAt: "2020-01-02T12:00:00Z" },
  { label: "normal", quality: 0, firstSeenAt: "2020-01-09T12:00:00Z" },
  { label: "normal", quality: 0, firstSeenAt: "2020-01-08T12:00:00Z" },
  { label: "muito_boa", quality: 10, firstSeenAt: "2020-01-07T12:00:00Z" }
];

describe.runIf(integration)("PostgresApiRepository", () => {
  let database: ReturnType<typeof createDatabase>;
  let repository: PostgresApiRepository;
  const offerIds: string[] = [];
  const installationId = randomUUID();

  beforeAll(async () => {
    database = createDatabase();
    repository = new PostgresApiRepository();
    const products = await database.client<{ id: string }[]>`
      insert into products (canonical_key, vendor, model, vram_gb)
      values (${PRODUCT_KEY}, 'NVIDIA', 'Integration Feed GPU', 8) returning id
    `;
    const stores = await database.client<{ id: string }[]>`
      insert into stores (domain, name) values (${STORE_DOMAIN}, ${STORE_DOMAIN}) returning id
    `;
    for (const offer of OFFERS) {
      const rows = await database.client<{ id: string }[]>`
        insert into offers (product_id, store_id, current_price_in_cents, lowest_price_in_cents,
          price_bucket_in_cents, condition, first_seen_at, last_seen_at, mention_count)
        values (${products[0]!.id}, ${stores[0]!.id}, 199900, 199900, 200000, 'new',
          ${offer.firstSeenAt}, ${offer.firstSeenAt}, 1)
        returning id
      `;
      const offerId = rows[0]!.id;
      offerIds.push(offerId);
      await database.client`
        insert into offer_scores (offer_id, policy_version, label, quality_score, confidence,
          input_hash, metrics, reasons, history_cutoff_at)
        values (${offerId}, 'integration', ${offer.label}, ${offer.quality}, 'high',
          ${randomUUID()}, '{}'::jsonb, '[]'::jsonb, ${offer.firstSeenAt})
      `;
    }
    await repository.upsertInstallation({
      id: installationId,
      platform: "android",
      appVersion: "1.0.0"
    });
  });

  afterAll(async () => {
    await database.client`delete from anonymous_events where installation_id = ${installationId}`;
    await database.client`delete from device_installations where id = ${installationId}`;
    for (const offerId of offerIds) {
      await database.client`delete from offer_scores where offer_id = ${offerId}`;
      await database.client`delete from offers where id = ${offerId}`;
    }
    await database.client`delete from stores where domain = ${STORE_DOMAIN}`;
    await database.client`delete from products where canonical_key = ${PRODUCT_KEY}`;
    await repository.onApplicationShutdown();
    await database.close();
  });

  it("pages through the feed in the same order as a single page, without gaps or repeats", async () => {
    const single = await repository.listOffers({ limit: 50 });
    expect(single.nextCursor).toBeNull();

    const paged: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 30; page += 1) {
      const result = await repository.listOffers({ limit: 2, ...(cursor ? { cursor } : {}) });
      paged.push(...result.items.map(({ id }) => id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(paged).toEqual(single.items.map(({ id }) => id));
    expect(paged.filter((id) => offerIds.includes(id))).toHaveLength(OFFERS.length);
  });

  it("stores no event of a batch that mentions an unregistered installation", async () => {
    const known = randomUUID();
    const result = await repository.addEvents([
      { id: known, installationId, name: "app_opened", occurredAt: "2026-10-26T12:00:00Z" },
      {
        id: randomUUID(),
        installationId: randomUUID(),
        name: "app_opened",
        occurredAt: "2026-10-26T12:00:00Z"
      }
    ]);

    expect(result).toEqual({ status: "unknown_installation" });
    const stored = await database.client<{ count: number }[]>`
      select count(*)::int from anonymous_events where id = ${known}
    `;
    expect(stored[0]?.count).toBe(0);
  });
});
