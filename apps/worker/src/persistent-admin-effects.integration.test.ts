import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FakeNotificationProvider } from "./notification.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";

const integration = process.env.RUN_PIPELINE_INTEGRATION === "true";
// Far from real data so the 48-hour deduplication window only sees this test's offers.
const CAPTURED_AT = "2020-02-10T12:00:00.000Z";
const ALIAS_PRODUCT_KEY = "nvidia-integration-alias-gpu-12gb";

interface ParseRow {
  status: string;
  errors: string[];
  productId: string | null;
  priceInCents: number | null;
  adminOverrides: Record<string, unknown>;
}

describe.runIf(integration)("admin curation effects on the pipeline", () => {
  let database: ReturnType<typeof createDatabase>;
  let pipeline: PersistentPipelineService;
  const sourceId = randomUUID();
  const blockedSourceId = randomUUID();
  const aliasMessageId = randomUUID();
  const correctedMessageId = randomUUID();
  const blockedMessageId = randomUUID();
  const messageIds = [aliasMessageId, correctedMessageId, blockedMessageId];

  async function insertMessage(id: string, source: string, text: string) {
    await database.client`
      insert into raw_messages (
        id, source_id, idempotency_key, text, original_payload, supplied_url, captured_at
      ) values (
        ${id}, ${source}, ${`integration-${id}`}, ${text}, ${database.client.json({})},
        ${`https://www.kabum.com.br/produto/${id.slice(0, 6).replace(/\D/g, "1")}9/gpu`}, ${CAPTURED_AT}
      )
    `;
  }

  async function latestParse(id: string): Promise<ParseRow | undefined> {
    const rows = await database.client<ParseRow[]>`
      select status::text, errors, candidate->'product'->>'id' as "productId",
        (candidate->'price'->>'amountInCents')::int as "priceInCents",
        admin_overrides as "adminOverrides"
      from raw_message_parses where raw_message_id = ${id} order by version desc limit 1
    `;
    return rows[0];
  }

  beforeAll(async () => {
    database = createDatabase();
    pipeline = new PersistentPipelineService(new FakeNotificationProvider());
    await database.client`
      insert into sources (id, name, kind) values
        (${sourceId}, 'integration-admin-effects', 'manual'),
        (${blockedSourceId}, 'integration-admin-blocked', 'manual')
    `;
    await database.client`update sources set blocked_at = now() where id = ${blockedSourceId}`;
    const products = await database.client<{ id: string }[]>`
      insert into products (canonical_key, vendor, model, vram_gb)
      values (${ALIAS_PRODUCT_KEY}, 'NVIDIA', 'Integration Alias GPU', 12) returning id
    `;
    await database.client`
      insert into product_aliases (product_id, normalized_alias)
      values (${products[0]!.id}, 'placa integracao xyz')
    `;
    await insertMessage(aliasMessageId, sourceId, "Placa Integracao XYZ por R$ 1.234 no Pix");
    await insertMessage(correctedMessageId, sourceId, "RTX 5060 8GB por R$ 1.999 no Pix");
    await insertMessage(blockedMessageId, blockedSourceId, "RTX 5060 8GB por R$ 1.888 no Pix");
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
    await database.client`delete from sources where id in (${sourceId}, ${blockedSourceId})`;
    await database.client`delete from product_aliases where normalized_alias = 'placa integracao xyz'`;
    await database.client`delete from products where canonical_key = ${ALIAS_PRODUCT_KEY}`;
    await database.client`delete from stores where domain = 'kabum.com.br' and not exists (select 1 from offers where store_id = stores.id)`;
    await database.client`delete from products where canonical_key = 'nvidia-rtx-5060-8gb' and not exists (select 1 from offers where product_id = products.id)`;
    await pipeline.onApplicationShutdown();
    await database.close();
  });

  it("identifies a product through an admin alias", async () => {
    await pipeline.resolveUrl(aliasMessageId, 1);

    expect(await pipeline.parse(aliasMessageId, 1)).toBe(true);
    expect(await latestParse(aliasMessageId)).toMatchObject({
      status: "completed",
      productId: ALIAS_PRODUCT_KEY
    });
  });

  it("keeps admin corrections when the message is reprocessed", async () => {
    await pipeline.resolveUrl(correctedMessageId, 1);
    expect(await pipeline.parse(correctedMessageId, 1)).toBe(true);
    await database.client`
      update raw_message_parses
      set admin_overrides = ${database.client.json({ priceInCents: 150_000, productKey: ALIAS_PRODUCT_KEY })}
      where raw_message_id = ${correctedMessageId}
    `;

    await pipeline.resolveUrl(correctedMessageId, 2);
    expect(await pipeline.parse(correctedMessageId, 2)).toBe(true);

    expect(await latestParse(correctedMessageId)).toMatchObject({
      status: "completed",
      productId: ALIAS_PRODUCT_KEY,
      priceInCents: 150_000,
      adminOverrides: { priceInCents: 150_000, productKey: ALIAS_PRODUCT_KEY }
    });
  });

  it("retires the offer of a message later marked as not an offer", async () => {
    expect(await pipeline.consolidate(aliasMessageId)).toBeTruthy();
    await database.client`
      update raw_message_parses set admin_overrides = ${database.client.json({ notAnOffer: true })}
      where raw_message_id = ${aliasMessageId}
    `;

    await pipeline.resolveUrl(aliasMessageId, 2);
    expect(await pipeline.parse(aliasMessageId, 2)).toBe(false);

    const state = await database.client<
      { activeMentions: number; activeSnapshots: number; offerStatus: string }[]
    >`
      select
        (select count(*)::int from offer_mentions where raw_message_id = ${aliasMessageId} and active) as "activeMentions",
        (select count(*)::int from price_snapshots where raw_message_id = ${aliasMessageId} and active) as "activeSnapshots",
        (select o.status::text from offers o join offer_mentions m on m.offer_id = o.id
          where m.raw_message_id = ${aliasMessageId} limit 1) as "offerStatus"
    `;
    expect(state[0]).toEqual({ activeMentions: 0, activeSnapshots: 0, offerStatus: "expired" });
  });

  it("keeps messages from blocked sources without turning them into offers", async () => {
    await pipeline.resolveUrl(blockedMessageId, 1);

    expect(await pipeline.parse(blockedMessageId, 1)).toBe(false);
    expect(await latestParse(blockedMessageId)).toMatchObject({
      status: "partial",
      errors: ["source_blocked"]
    });
    const raw = await database.client<{ count: number }[]>`
      select count(*)::int from raw_messages where id = ${blockedMessageId}
    `;
    expect(raw[0]?.count).toBe(1);
  });
});
