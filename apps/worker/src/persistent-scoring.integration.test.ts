import { randomUUID } from "node:crypto";

import { createDatabase } from "@sale-advisor/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FakeNotificationProvider } from "./notification.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";

const integration = process.env.RUN_PIPELINE_INTEGRATION === "true";
// Dedicated products (identified by admin aliases) keep real price history out of these tests.
const MEDIAN_PRODUCT = "nvidia-integration-median-gpu-8gb";
const RESCORE_PRODUCT = "nvidia-integration-rescore-gpu-8gb";
const NO_EXPIRY_HOURS = 24 * 365 * 100;

interface Message {
  id: string;
  alias: string;
  price: string;
  url: string;
  capturedAt: string;
}

describe.runIf(integration)("persistent scoring and offer expiry", () => {
  let database: ReturnType<typeof createDatabase>;
  let pipeline: PersistentPipelineService;
  let expiringPipeline: PersistentPipelineService;
  const sourceId = randomUUID();
  const messages = new Map<string, Message>();

  function message(name: string, data: Omit<Message, "id">) {
    messages.set(name, { id: randomUUID(), ...data });
  }

  async function process(service: PersistentPipelineService, name: string, version = 1) {
    const id = messages.get(name)!.id;
    await service.resolveUrl(id, version);
    await service.parse(id, version);
    await service.consolidate(id);
    await service.scoreAffected(id);
  }

  async function offerOf(name: string) {
    const rows = await database.client<{ id: string; status: string; label: string | null }[]>`
      select o.id, o.status::text,
        (select label from offer_scores where offer_id = o.id order by created_at desc limit 1) as label
      from offers o join offer_mentions om on om.offer_id = o.id and om.active
      where om.raw_message_id = ${messages.get(name)!.id} limit 1
    `;
    return rows[0];
  }

  async function activeOffersOf(productKey: string) {
    const rows = await database.client<{ count: number }[]>`
      select count(*)::int from offers o join products p on p.id = o.product_id
      where p.canonical_key = ${productKey} and o.status = 'active'
    `;
    return rows[0]?.count;
  }

  beforeAll(async () => {
    database = createDatabase();
    pipeline = new PersistentPipelineService(new FakeNotificationProvider(), {
      offerTtlHours: NO_EXPIRY_HOURS
    });
    expiringPipeline = new PersistentPipelineService(new FakeNotificationProvider(), {
      offerTtlHours: 72
    });
    await database.client`
      insert into sources (id, name, kind) values (${sourceId}, 'integration-scoring', 'manual')
    `;
    for (const [key, alias] of [
      [MEDIAN_PRODUCT, "placa integracao mediana"],
      [RESCORE_PRODUCT, "placa integracao rescore"]
    ]) {
      const products = await database.client<{ id: string }[]>`
        insert into products (canonical_key, vendor, model, vram_gb)
        values (${key}, 'NVIDIA', ${alias}, 8) returning id
      `;
      await database.client`
        insert into product_aliases (product_id, normalized_alias) values (${products[0]!.id}, ${alias})
      `;
    }

    const median = "Placa Integracao Mediana";
    message("median-1", {
      alias: median,
      price: "2.000",
      url: "https://www.amazon.com.br/dp/B0MEDIAN01",
      capturedAt: "2020-05-01T12:00:00Z"
    });
    message("median-2", {
      alias: median,
      price: "2.000",
      url: "https://www.terabyteshop.com.br/produto/9100002/gpu",
      capturedAt: "2020-05-02T12:00:00Z"
    });
    message("median-3", {
      alias: median,
      price: "2.000",
      url: "https://www.magazineluiza.com.br/gpu/p/mediana003/in/pcvd/",
      capturedAt: "2020-05-03T12:00:00Z"
    });
    message("median-deal", {
      alias: median,
      price: "1.800",
      url: "https://www.kabum.com.br/produto/9100004/gpu",
      capturedAt: "2020-05-05T12:00:00Z"
    });

    const rescore = "Placa Integracao Rescore";
    message("rescore-1", {
      alias: rescore,
      price: "2.000",
      url: "https://www.amazon.com.br/dp/B0RESCOR01",
      capturedAt: "2020-06-01T12:00:00Z"
    });
    message("rescore-2", {
      alias: rescore,
      price: "2.000",
      url: "https://www.terabyteshop.com.br/produto/9200002/gpu",
      capturedAt: "2020-06-02T12:00:00Z"
    });
    message("rescore-deal", {
      alias: rescore,
      price: "1.800",
      url: "https://www.kabum.com.br/produto/9200004/gpu",
      capturedAt: "2020-06-03T12:00:00Z"
    });
    message("rescore-3", {
      alias: rescore,
      price: "2.000",
      url: "https://www.magazineluiza.com.br/gpu/p/rescore003/in/pcvd/",
      capturedAt: "2020-06-04T00:00:00Z"
    });
    message("rescore-repost", {
      alias: rescore,
      price: "1.800",
      url: "https://www.kabum.com.br/produto/9200004/gpu",
      capturedAt: "2020-06-04T12:00:00Z"
    });

    for (const data of messages.values()) {
      await database.client`
        insert into raw_messages (
          id, source_id, idempotency_key, text, original_payload, supplied_url, captured_at
        ) values (
          ${data.id}, ${sourceId}, ${`integration-${data.id}`},
          ${`${data.alias} por R$ ${data.price} no Pix`}, ${database.client.json({})},
          ${data.url}, ${data.capturedAt}
        )
      `;
    }
  });

  afterAll(async () => {
    const ids = [...messages.values()].map(({ id }) => id);
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
    await database.client`delete from sources where id = ${sourceId}`;
    for (const key of [MEDIAN_PRODUCT, RESCORE_PRODUCT]) {
      await database.client`
        delete from product_aliases where product_id = (select id from products where canonical_key = ${key})
      `;
      await database.client`delete from products where canonical_key = ${key}`;
    }
    await pipeline.onApplicationShutdown();
    await expiringPipeline.onApplicationShutdown();
    await database.close();
  });

  it("labels an offer by the 30-day median of earlier offers of the same product", async () => {
    for (const name of ["median-1", "median-2", "median-3", "median-deal"])
      await process(pipeline, name);

    expect((await offerOf("median-deal"))?.label).toBe("muito_boa");
  });

  it("rescores an existing offer when a new mention arrives", async () => {
    for (const name of ["rescore-1", "rescore-2", "rescore-deal"]) await process(pipeline, name);
    const before = await offerOf("rescore-deal");
    expect(before?.label).toBe("normal");

    await process(pipeline, "rescore-3");
    await process(pipeline, "rescore-repost");

    const after = await offerOf("rescore-repost");
    expect(after?.id).toBe(before?.id);
    expect(after?.label).toBe("muito_boa");
  });

  it("expires offers without a mention for longer than the TTL", async () => {
    const expired = await expiringPipeline.expireStaleOffers(new Date("2020-06-06T00:00:00Z"));

    expect(expired).toBeGreaterThan(0);
    expect(await activeOffersOf(MEDIAN_PRODUCT)).toBe(0);
    expect((await offerOf("rescore-repost"))?.status).toBe("active");
    expect((await offerOf("rescore-1"))?.status).toBe("expired");
  });

  it("does not reactivate stale offers when old messages are reprocessed", async () => {
    await process(expiringPipeline, "median-1", 2);

    expect((await offerOf("median-1"))?.status).toBe("expired");
    expect(await activeOffersOf(MEDIAN_PRODUCT)).toBe(0);
  });
});
