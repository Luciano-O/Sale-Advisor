import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresApiRepository } from "./postgres-repository.js";
import { InvalidCursorError } from "./repository.js";

const integration = process.env.RUN_API_INTEGRATION === "true";
const PRODUCT_KEY = "nvidia-integration-feed-gpu-8gb";
const STORE_DOMAIN = "integration-feed.example";
const BLOCKED_STORE_DOMAIN = "integration-feed-blocked.example";

// Ties on first_seen_at and on the discount, plus offers without history, exercise every
// column of both feed orderings. Scores store the deviation, so -12.5 is a 12.5% discount.
const OFFERS: Array<{
  label: string;
  firstSeenAt: string;
  deviation: number | null;
  status?: "expired";
}> = [
  { label: "excepcional", firstSeenAt: "2020-01-01T12:00:00Z", deviation: -30 },
  { label: "boa", firstSeenAt: "2020-01-05T12:00:00Z", deviation: -12.5 },
  { label: "boa", firstSeenAt: "2020-01-05T12:00:00Z", deviation: -12.5 },
  { label: "boa", firstSeenAt: "2020-01-02T12:00:00Z", deviation: null },
  { label: "normal", firstSeenAt: "2020-01-09T12:00:00Z", deviation: 4 },
  { label: "normal", firstSeenAt: "2020-01-08T12:00:00Z", deviation: null },
  { label: "muito_boa", firstSeenAt: "2020-01-07T12:00:00Z", deviation: -12.5 },
  { label: "muito_boa", firstSeenAt: "2020-01-06T12:00:00Z", deviation: -40, status: "expired" }
];
const ACTIVE_COUNT = OFFERS.filter(({ status }) => !status).length;

function metricsFor(deviation: number | null) {
  return deviation === null
    ? {}
    : {
        medianPriceIn30dInCents: 220000,
        lowestPriceIn90dInCents: 190000,
        deviationFromMedian30dPercent: deviation
      };
}

async function pageThrough(
  repository: PostgresApiRepository,
  sort: "recent" | "discount"
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 60; page += 1) {
    const result = await repository.listOffers({ limit: 2, sort, ...(cursor ? { cursor } : {}) });
    ids.push(...result.items.map(({ id }) => id));
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return ids;
}

describe.runIf(integration)("PostgresApiRepository", () => {
  let database: ReturnType<typeof createDatabase>;
  let repository: PostgresApiRepository;
  const offerIds: string[] = [];
  let blockedOfferId: string;
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
        insert into offers (product_id, store_id, status, current_price_in_cents,
          lowest_price_in_cents, price_bucket_in_cents, condition, first_seen_at, last_seen_at,
          mention_count)
        values (${products[0]!.id}, ${stores[0]!.id}, ${offer.status ?? "active"}, 199900, 199900,
          200000, 'new', ${offer.firstSeenAt}, ${offer.firstSeenAt}, 1)
        returning id
      `;
      const offerId = rows[0]!.id;
      offerIds.push(offerId);
      await database.client`
        insert into offer_scores (offer_id, policy_version, label, quality_score, confidence,
          input_hash, metrics, reasons, history_cutoff_at)
        values (${offerId}, 'integration', ${offer.label}, 50, 'high',
          ${randomUUID()}, ${database.client.json(metricsFor(offer.deviation))}, '[]'::jsonb,
          ${offer.firstSeenAt})
      `;
    }
    const blockedStores = await database.client<{ id: string }[]>`
      insert into stores (domain, name, blocked_at)
      values (${BLOCKED_STORE_DOMAIN}, ${BLOCKED_STORE_DOMAIN}, now()) returning id
    `;
    const blocked = await database.client<{ id: string }[]>`
      insert into offers (product_id, store_id, current_price_in_cents, lowest_price_in_cents,
        price_bucket_in_cents, condition, first_seen_at, last_seen_at, mention_count)
      values (${products[0]!.id}, ${blockedStores[0]!.id}, 199900, 199900, 200000, 'new',
        '2020-01-03T12:00:00Z', '2020-01-03T12:00:00Z', 1)
      returning id
    `;
    blockedOfferId = blocked[0]!.id;
    await repository.upsertInstallation({
      id: installationId,
      platform: "android",
      appVersion: "1.0.0"
    });
  });

  afterAll(async () => {
    await database.client`delete from anonymous_events where installation_id = ${installationId}`;
    await database.client`delete from device_installations where id = ${installationId}`;
    for (const offerId of [...offerIds, blockedOfferId]) {
      await database.client`delete from offer_scores where offer_id = ${offerId}`;
      await database.client`delete from offers where id = ${offerId}`;
    }
    await database.client`
      delete from stores where domain in (${STORE_DOMAIN}, ${BLOCKED_STORE_DOMAIN})
    `;
    await database.client`delete from products where canonical_key = ${PRODUCT_KEY}`;
    await repository.onApplicationShutdown();
    await database.close();
  });

  it.each(["recent", "discount"] as const)(
    "pages through the %s feed in the same order as a single page, without gaps or repeats",
    async (sort) => {
      const single = await repository.listOffers({ limit: 50, sort });
      expect(single.nextCursor).toBeNull();

      const paged = await pageThrough(repository, sort);

      expect(paged).toEqual(single.items.map(({ id }) => id));
      expect(paged.filter((id) => offerIds.includes(id))).toHaveLength(ACTIVE_COUNT);
      expect(paged).not.toContain(blockedOfferId);
    }
  );

  it("orders the recent feed by first seen, newest first", async () => {
    const paged = (await pageThrough(repository, "recent")).filter((id) => offerIds.includes(id));
    const firstSeen = paged.map((id) => OFFERS[offerIds.indexOf(id)]!.firstSeenAt);

    expect(firstSeen).toEqual([...firstSeen].sort().reverse());
  });

  it("orders the discount feed by biggest discount, offers without history last", async () => {
    const paged = (await pageThrough(repository, "discount")).filter((id) => offerIds.includes(id));

    expect(paged.map((id) => OFFERS[offerIds.indexOf(id)]!.deviation)).toEqual([
      -30,
      -12.5,
      -12.5,
      -12.5,
      4,
      null,
      null
    ]);
  });

  it("rejects a cursor produced by the other ordering", async () => {
    const recent = await repository.listOffers({ limit: 1, sort: "recent" });

    await expect(
      repository.listOffers({ limit: 1, sort: "discount", cursor: recent.nextCursor! })
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it("shows the price history of an offer, or nulls when there is not enough", async () => {
    const withHistory = await repository.findOffer(offerIds[1]!);
    const withoutHistory = await repository.findOffer(offerIds[3]!);

    expect(withHistory).toMatchObject({
      status: "active",
      history: { median30dInCents: 220000, lowest90dInCents: 190000, discountVsMedianPercent: 12.5 }
    });
    expect(withoutHistory?.history).toEqual({
      median30dInCents: null,
      lowest90dInCents: null,
      discountVsMedianPercent: null
    });
  });

  it("opens an expired offer in the detail, but not one from a blocked store", async () => {
    const expiredId = offerIds[OFFERS.findIndex(({ status }) => status === "expired")]!;

    expect(await repository.findOffer(expiredId)).toMatchObject({
      id: expiredId,
      status: "expired",
      history: { discountVsMedianPercent: 40 }
    });
    expect(await repository.findOffer(blockedOfferId)).toBeNull();
  });

  it("lists the stores the app can block, without blocked ones", async () => {
    const stores = await repository.listStores();

    expect(stores).toContainEqual({ name: STORE_DOMAIN, domain: STORE_DOMAIN });
    expect(stores.map(({ domain }) => domain)).not.toContain(BLOCKED_STORE_DOMAIN);
    expect(new Set(stores.map(({ domain }) => domain)).size).toBe(stores.length);
  });

  it("lists each model with offers once in the catalog", async () => {
    const catalog = await repository.listCatalog();

    expect(catalog.filter(({ model }) => model === "Integration Feed GPU")).toEqual([
      { category: "GPU", vendor: "NVIDIA", model: "Integration Feed GPU" }
    ]);
    expect(new Set(catalog.map(({ vendor, model }) => `${vendor}|${model}`)).size).toBe(
      catalog.length
    );
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
