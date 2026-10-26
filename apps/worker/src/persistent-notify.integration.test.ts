import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FakeNotificationProvider } from "./notification.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";

const integration = process.env.RUN_PIPELINE_INTEGRATION === "true";
// A dedicated product (identified by an admin alias) keeps real price history out of the score.
const PRODUCT_KEY = "nvidia-integration-notify-gpu-8gb";
const ALIAS = "placa integracao notify";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

describe.runIf(integration)("persistent offer notifications", () => {
  let database: ReturnType<typeof createDatabase>;
  let notifications: FakeNotificationProvider;
  let pipeline: PersistentPipelineService;
  const sourceId = randomUUID();
  const installationId = randomUUID();
  const history = [
    { url: "https://www.amazon.com.br/dp/B0NOTIFY01", capturedAt: hoursAgo(50) },
    { url: "https://www.terabyteshop.com.br/produto/9300002/gpu", capturedAt: hoursAgo(40) },
    { url: "https://www.magazineluiza.com.br/gpu/p/notifyab03/in/pcvd/", capturedAt: hoursAgo(30) }
  ].map((message) => ({ id: randomUUID(), price: "2.000", notify: false, ...message }));
  const deal = {
    id: randomUUID(),
    price: "1.800",
    notify: true,
    url: "https://www.kabum.com.br/produto/9300004/gpu",
    capturedAt: hoursAgo(1)
  };
  const messages = [...history, deal];

  beforeAll(async () => {
    database = createDatabase();
    notifications = new FakeNotificationProvider();
    pipeline = new PersistentPipelineService(notifications);
    await database.client`
      insert into sources (id, name, kind) values (${sourceId}, 'integration-notify', 'manual')
    `;
    const products = await database.client<{ id: string }[]>`
      insert into products (canonical_key, vendor, model, vram_gb)
      values (${PRODUCT_KEY}, 'NVIDIA', 'Integration Notify GPU', 8) returning id
    `;
    await database.client`
      insert into product_aliases (product_id, normalized_alias) values (${products[0]!.id}, ${ALIAS})
    `;
    await database.client`
      insert into device_installations (id, platform, app_version, push_target, push_enabled)
      values (${installationId}, 'android', '1.0.0', 'fake-device-token', true)
    `;
    await database.client`
      insert into notification_subscriptions (installation_id, minimum_label)
      values (${installationId}, 'boa')
    `;
    for (const message of messages)
      await database.client`
        insert into raw_messages (
          id, source_id, idempotency_key, text, original_payload, supplied_url, captured_at,
          notify_eligible
        ) values (
          ${message.id}, ${sourceId}, ${`integration-${message.id}`},
          ${`Placa Integracao Notify por R$ ${message.price} no Pix`}, ${database.client.json({})},
          ${message.url}, ${message.capturedAt}, ${message.notify}
        )
      `;
  });

  afterAll(async () => {
    const ids = messages.map(({ id }) => id);
    const offers = await database.client<{ id: string }[]>`
      select distinct offer_id as id from offer_mentions where raw_message_id in ${database.client(ids)}
    `;
    for (const offer of offers) {
      await database.client`delete from notification_deliveries where offer_id = ${offer.id}`;
      await database.client`delete from offer_scores where offer_id = ${offer.id}`;
    }
    for (const id of ids) {
      await database.client`delete from price_snapshots where raw_message_id = ${id}`;
      await database.client`delete from offer_mentions where raw_message_id = ${id}`;
    }
    for (const offer of offers) await database.client`delete from offers where id = ${offer.id}`;
    for (const id of ids) {
      await database.client`delete from raw_message_parses where raw_message_id = ${id}`;
      await database.client`delete from url_resolutions where raw_message_id = ${id}`;
      await database.client`delete from outbox_events where aggregate_id = ${id}`;
      await database.client`delete from raw_messages where id = ${id}`;
    }
    await database.client`delete from notification_subscriptions where installation_id = ${installationId}`;
    await database.client`delete from device_installations where id = ${installationId}`;
    await database.client`delete from sources where id = ${sourceId}`;
    await database.client`
      delete from product_aliases where product_id = (select id from products where canonical_key = ${PRODUCT_KEY})
    `;
    await database.client`delete from products where canonical_key = ${PRODUCT_KEY}`;
    await pipeline.onApplicationShutdown();
    await database.close();
  });

  it("sends and records an offer summary the app can filter and show offline", async () => {
    for (const message of messages) {
      await pipeline.resolveUrl(message.id, 1);
      await pipeline.parse(message.id, 1);
      await pipeline.consolidate(message.id);
      await pipeline.scoreAffected(message.id);
    }
    await pipeline.notify(deal.id);

    const products = await database.client<{ id: string }[]>`
      select id from products where canonical_key = ${PRODUCT_KEY}
    `;
    const expectedSummary = {
      productId: products[0]!.id,
      vendor: "NVIDIA",
      model: "Integration Notify GPU",
      vramGb: 8,
      storeName: "kabum.com.br",
      storeDomain: "kabum.com.br",
      priceCents: 180_000,
      label: "muito_boa"
    };
    const sent = notifications.deliveries.filter(
      ({ target }) => target.installationId === installationId
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload.summary).toEqual(expectedSummary);

    const stored = await database.client<{ payload: Record<string, unknown> }[]>`
      select payload from notification_deliveries where installation_id = ${installationId}
    `;
    expect(stored[0]?.payload).toMatchObject({ summary: expectedSummary });
  });
});
