import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FakeNotificationProvider } from "./notification.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";

const integration = process.env.RUN_PIPELINE_INTEGRATION === "true";

describe.runIf(integration)("persistent URL resolution and reprocessing", () => {
  let database: ReturnType<typeof createDatabase>;
  let pipeline: PersistentPipelineService;
  const sourceId = randomUUID();
  const rawMessageId = randomUUID();
  const failedRawMessageId = randomUUID();

  beforeAll(async () => {
    database = createDatabase();
    pipeline = new PersistentPipelineService(new FakeNotificationProvider());
    await database.client`
      insert into sources (id, name, kind) values (${sourceId}, 'integration-url-resolution', 'manual')
    `;
    await database.client`
      insert into raw_messages (
        id, source_id, idempotency_key, text, original_payload, supplied_url, captured_at
      ) values (
        ${failedRawMessageId}, ${sourceId}, ${`integration-${failedRawMessageId}`},
        'RTX 4060 8GB por R$ 1.899 no Pix https://meli.la/unavailable',
        ${database.client.json({})}, 'https://meli.la/unavailable', now()
      )
    `;
    await database.client`
      insert into raw_messages (
        id, source_id, idempotency_key, text, original_payload, supplied_url, captured_at
      ) values (
        ${rawMessageId}, ${sourceId}, ${`integration-${rawMessageId}`},
        'RTX 4060 8GB por R$ 1.899 no Pix cupom GPU10', ${database.client.json({})},
        'https://www.amazon.com.br/dp/B0ABC12345?tag=affiliate', now()
      )
    `;
  });

  afterAll(async () => {
    const offers = await database.client<{ id: string }[]>`
      select distinct offer_id as id from offer_mentions where raw_message_id = ${rawMessageId}
    `;
    for (const offer of offers) {
      await database.client`delete from notification_deliveries where offer_id = ${offer.id}`;
      await database.client`delete from offer_scores where offer_id = ${offer.id}`;
    }
    await database.client`delete from price_snapshots where raw_message_id = ${rawMessageId}`;
    await database.client`delete from offer_mentions where raw_message_id = ${rawMessageId}`;
    for (const offer of offers) await database.client`delete from offers where id = ${offer.id}`;
    await database.client`delete from raw_message_parses where raw_message_id = ${rawMessageId}`;
    await database.client`delete from url_resolutions where raw_message_id = ${rawMessageId}`;
    await database.client`delete from outbox_events where aggregate_id = ${rawMessageId}`;
    await database.client`delete from raw_messages where id = ${rawMessageId}`;
    await database.client`delete from raw_message_parses where raw_message_id = ${failedRawMessageId}`;
    await database.client`delete from url_resolutions where raw_message_id = ${failedRawMessageId}`;
    await database.client`delete from raw_messages where id = ${failedRawMessageId}`;
    await database.client`delete from sources where id = ${sourceId}`;
    await database.client`delete from stores where domain in ('amazon.com.br', 'mercadolivre.com.br') and not exists (select 1 from offers where store_id = stores.id)`;
    await database.client`delete from products where canonical_key = 'nvidia-rtx-4060-8gb' and not exists (select 1 from offers where product_id = products.id)`;
    await pipeline.onApplicationShutdown();
    await database.close();
  });

  it("keeps audit history and supersedes mention/snapshot when the final store changes", async () => {
    await pipeline.resolveUrl(rawMessageId, 1);
    expect(await pipeline.parse(rawMessageId, 1)).toBe(true);
    const oldOfferId = await pipeline.consolidate(rawMessageId);
    expect(oldOfferId).toBeTruthy();

    await database.client`
      update raw_messages set supplied_url = 'https://produto.mercadolivre.com.br/MLB-1234567890-gpu-_JM',
        updated_at = now() where id = ${rawMessageId}
    `;
    await pipeline.resolveUrl(rawMessageId, 2);
    expect(await pipeline.parse(rawMessageId, 2)).toBe(true);
    const newOfferId = await pipeline.consolidate(rawMessageId);
    expect(newOfferId).toBeTruthy();
    expect(newOfferId).not.toBe(oldOfferId);

    await pipeline.resolveUrl(rawMessageId, 2);
    expect(await pipeline.parse(rawMessageId, 2)).toBe(true);
    expect(await pipeline.consolidate(rawMessageId)).toBe(newOfferId);

    const counts = await database.client<
      Array<{
        parses: number;
        resolutions: number;
        mentions: number;
        activeMentions: number;
        snapshots: number;
        activeSnapshots: number;
      }>
    >`
      select
        (select count(*)::int from raw_message_parses where raw_message_id = ${rawMessageId}) as parses,
        (select count(*)::int from url_resolutions where raw_message_id = ${rawMessageId}) as resolutions,
        (select count(*)::int from offer_mentions where raw_message_id = ${rawMessageId}) as mentions,
        (select count(*)::int from offer_mentions where raw_message_id = ${rawMessageId} and active) as "activeMentions",
        (select count(*)::int from price_snapshots where raw_message_id = ${rawMessageId}) as snapshots,
        (select count(*)::int from price_snapshots where raw_message_id = ${rawMessageId} and active) as "activeSnapshots"
    `;
    expect(counts[0]).toEqual({
      parses: 2,
      resolutions: 2,
      mentions: 2,
      activeMentions: 1,
      snapshots: 2,
      activeSnapshots: 1
    });
    const offerStates = await database.client<
      Array<{ id: string; status: string; mentionCount: number }>
    >`
      select id, status::text, mention_count as "mentionCount" from offers
      where id in (${oldOfferId}, ${newOfferId}) order by id
    `;
    expect(offerStates).toContainEqual({ id: oldOfferId, status: "expired", mentionCount: 0 });
    expect(offerStates).toContainEqual({ id: newOfferId, status: "active", mentionCount: 1 });
  });

  it("produces a partial v3 parse without a shortener-domain offer after resolution failure", async () => {
    await database.client`
      insert into url_resolutions (
        raw_message_id, original_url, original_url_hash, redirect_chain, status,
        resolver_version, pipeline_version, attempts, error, resolved_at
      ) values (
        ${failedRawMessageId}, 'https://meli.la/unavailable', ${"f".repeat(64)},
        ${database.client.json(["https://meli.la/unavailable"])}, 'failed',
        'safe-redirect-v1', 1, 3, ${database.client.json({ code: "network_error" })}, now()
      )
    `;
    expect(await pipeline.parse(failedRawMessageId, 1)).toBe(false);
    const rows = await database.client<
      Array<{
        parserVersion: number;
        status: string;
        candidate: { domain: string | null };
        errors: string[];
      }>
    >`
      select parser_version as "parserVersion", status::text, candidate, errors
      from raw_message_parses where raw_message_id = ${failedRawMessageId}
    `;
    expect(rows[0]).toMatchObject({
      parserVersion: 3,
      status: "partial",
      candidate: { domain: null },
      errors: ["url_resolution_failed"]
    });
    expect(await pipeline.consolidate(failedRawMessageId)).toBeNull();
  });
});
