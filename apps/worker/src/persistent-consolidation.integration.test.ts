import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FakeNotificationProvider } from "./notification.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";

const integration = process.env.RUN_PIPELINE_INTEGRATION === "true";
// Far from real data so the 48-hour deduplication window only sees this test's offers.
const CAPTURED_AT = "2020-01-15T12:00:00.000Z";

describe.runIf(integration)("persistent offer consolidation", () => {
  let database: ReturnType<typeof createDatabase>;
  let pipeline: PersistentPipelineService;
  const sourceId = randomUUID();
  const withoutIdMessageId = randomUUID();
  const withIdMessageId = randomUUID();
  const messageIds = [withoutIdMessageId, withIdMessageId];

  beforeAll(async () => {
    database = createDatabase();
    pipeline = new PersistentPipelineService(new FakeNotificationProvider());
    await database.client`
      insert into sources (id, name, kind) values (${sourceId}, 'integration-consolidation', 'manual')
    `;
    for (const [id, url] of [
      [withoutIdMessageId, "https://www.kabum.com.br/promocao/GPU10"],
      [withIdMessageId, "https://www.kabum.com.br/produto/123456/placa-de-video-rtx-5060"]
    ] as const) {
      await database.client`
        insert into raw_messages (
          id, source_id, idempotency_key, text, original_payload, supplied_url, captured_at
        ) values (
          ${id}, ${sourceId}, ${`integration-${id}`}, 'Placa de video RTX 5060 8GB por R$ 2.111 no Pix',
          ${database.client.json({})}, ${url}, ${CAPTURED_AT}
        )
      `;
    }
  });

  afterAll(async () => {
    const offers = await database.client<{ id: string }[]>`
      select distinct offer_id as id from offer_mentions where raw_message_id in ${database.client(messageIds)}
    `;
    for (const offer of offers) {
      await database.client`delete from notification_deliveries where offer_id = ${offer.id}`;
      await database.client`delete from offer_scores where offer_id = ${offer.id}`;
    }
    for (const id of messageIds) {
      await database.client`delete from price_snapshots where raw_message_id = ${id}`;
      await database.client`delete from offer_mentions where raw_message_id = ${id}`;
    }
    for (const offer of offers) await database.client`delete from offers where id = ${offer.id}`;
    for (const id of messageIds) {
      await database.client`delete from raw_message_parses where raw_message_id = ${id}`;
      await database.client`delete from url_resolutions where raw_message_id = ${id}`;
      await database.client`delete from outbox_events where aggregate_id = ${id}`;
      await database.client`delete from raw_messages where id = ${id}`;
    }
    await database.client`delete from sources where id = ${sourceId}`;
    await database.client`delete from stores where domain = 'kabum.com.br' and not exists (select 1 from offers where store_id = stores.id)`;
    await database.client`delete from products where canonical_key = 'nvidia-rtx-5060-8gb' and not exists (select 1 from offers where product_id = products.id)`;
    await pipeline.onApplicationShutdown();
    await database.close();
  });

  it("fills the store product id of an existing offer from a later mention", async () => {
    await pipeline.resolveUrl(withoutIdMessageId, 1);
    expect(await pipeline.parse(withoutIdMessageId, 1)).toBe(true);
    const offerId = await pipeline.consolidate(withoutIdMessageId);

    await pipeline.resolveUrl(withIdMessageId, 1);
    expect(await pipeline.parse(withIdMessageId, 1)).toBe(true);
    expect(await pipeline.consolidate(withIdMessageId)).toBe(offerId);

    const offers = await database.client<{ storeProductId: string | null; mentionCount: number }[]>`
      select store_product_id as "storeProductId", mention_count as "mentionCount"
      from offers where id = ${offerId}
    `;
    expect(offers[0]).toEqual({ storeProductId: "123456", mentionCount: 2 });
  });
});
