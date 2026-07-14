import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiTestApp, type ApiTestContext } from "./test-app.js";

const ADMIN_KEY = "test-admin-key-with-at-least-32-characters";

describe("MVP API", () => {
  let context: ApiTestContext;

  beforeEach(async () => {
    context = await createApiTestApp({ adminKey: ADMIN_KEY });
  });

  afterEach(async () => {
    await context.app.close();
  });

  it("reports pipeline health without exposing secrets", async () => {
    const response = await request(context.app.getHttpServer()).get("/v1/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok", database: "memory", outboxPending: 0 });
    expect(JSON.stringify(response.body)).not.toContain(ADMIN_KEY);
  });

  it("requires the admin key and uses the manual contract with notifications enabled", async () => {
    const payload = {
      text: "RTX 4060 8GB por R$ 1.899 no Pix",
      capturedAt: "2026-07-14T12:00:00.000Z",
      storeDomain: "shop.example"
    };
    await request(context.app.getHttpServer()).post("/v1/admin/messages").send(payload).expect(401);
    const response = await request(context.app.getHttpServer())
      .post("/v1/admin/messages")
      .set("x-admin-key", ADMIN_KEY)
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({ status: "pending", notifyEligible: true });
    expect(context.repository.outbox).toHaveLength(1);
  });

  it("rejects an invalid top level but preserves valid items in a partial import", async () => {
    await request(context.app.getHttpServer())
      .post("/v1/admin/imports")
      .set("x-admin-key", ADMIN_KEY)
      .send({ schemaVersion: 2 })
      .expect(400);

    const response = await request(context.app.getHttpServer())
      .post("/v1/admin/imports")
      .set("x-admin-key", ADMIN_KEY)
      .send({
        schemaVersion: 1,
        source: { name: "Carga inicial", kind: "import" },
        messages: [
          {
            externalId: "valid",
            text: "RX 7600 por R$ 1.500",
            capturedAt: "2026-07-14T12:00:00.000Z"
          },
          { externalId: "invalid", text: "", capturedAt: "not-a-date" }
        ]
      })
      .expect(201);

    expect(response.body).toMatchObject({
      status: "partial",
      acceptedCount: 1,
      rejectedCount: 1,
      notifyEligible: false
    });
    expect(response.body.rejections[0]).toMatchObject({ index: 1 });
  });

  it("is idempotent for an external id inside the same source", async () => {
    const payload = {
      schemaVersion: 1,
      source: { name: "Carga", kind: "import" },
      messages: [
        { externalId: "same", text: "RTX 4060 R$ 1.900", capturedAt: "2026-07-14T12:00:00.000Z" }
      ]
    };
    const first = await request(context.app.getHttpServer())
      .post("/v1/admin/imports")
      .set("x-admin-key", ADMIN_KEY)
      .send(payload)
      .expect(201);
    const second = await request(context.app.getHttpServer())
      .post("/v1/admin/imports")
      .set("x-admin-key", ADMIN_KEY)
      .send(payload)
      .expect(201);
    expect(second.body.messageIds).toEqual(first.body.messageIds);
    expect(context.repository.rawMessages).toHaveLength(1);
  });

  it("paginates the public feed and never exposes raw or dedupe fields", async () => {
    for (let index = 0; index < 3; index += 1) context.repository.publishOffer({ index });
    const first = await request(context.app.getHttpServer()).get("/v1/offers?limit=2").expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTypeOf("string");
    expect(JSON.stringify(first.body)).not.toMatch(/rawText|normalizedUrlHash|snapshotId|dedupe/i);
    await request(context.app.getHttpServer()).get("/v1/offers?limit=51").expect(400);
    await request(context.app.getHttpServer())
      .get(`/v1/offers/${first.body.items[0].id}`)
      .expect(200);
  });

  it("upserts anonymous installations, preferences and idempotent event batches", async () => {
    const installationId = "5fa72ea4-2441-45cd-8993-4d56e837cc4a";
    await request(context.app.getHttpServer())
      .post("/v1/installations")
      .send({ id: installationId, platform: "android", appVersion: "1.0.0" })
      .expect(201);
    await request(context.app.getHttpServer())
      .put(`/v1/installations/${installationId}/notification-preferences`)
      .send({ category: "GPU", minimumLabel: "boa" })
      .expect(200);

    const batch = {
      events: [
        {
          id: "168f1d1e-d51c-45a6-8465-a86f5e9af177",
          installationId,
          name: "offer_clicked",
          occurredAt: "2026-07-14T12:00:00.000Z"
        }
      ]
    };
    expect(
      (await request(context.app.getHttpServer()).post("/v1/events/batch").send(batch).expect(201))
        .body.acceptedCount
    ).toBe(1);
    expect(
      (await request(context.app.getHttpServer()).post("/v1/events/batch").send(batch).expect(201))
        .body.acceptedCount
    ).toBe(0);
  });

  it("exposes authenticated pipeline counters and audits replay justification", async () => {
    const created = await request(context.app.getHttpServer())
      .post("/v1/admin/messages")
      .set("x-admin-key", ADMIN_KEY)
      .send({ text: "RTX 4060 R$ 1.900", capturedAt: "2026-07-14T12:00:00.000Z" })
      .expect(201);
    await request(context.app.getHttpServer())
      .get("/v1/admin/dashboard")
      .set("x-admin-key", ADMIN_KEY)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ pending: 1 }));
    await request(context.app.getHttpServer())
      .post(`/v1/admin/messages/${created.body.messageId}/reprocess`)
      .set("x-admin-key", ADMIN_KEY)
      .send({ justification: "" })
      .expect(400);
    await request(context.app.getHttpServer())
      .post(`/v1/admin/messages/${created.body.messageId}/reprocess`)
      .set("x-admin-key", ADMIN_KEY)
      .send({ justification: "Parser atualizado para o caso real" })
      .expect(201);
    expect(context.repository.audit).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "message.reprocess" })])
    );
  });

  it("exposes curation lists and validates every audit-sensitive action", async () => {
    const headers = { "x-admin-key": ADMIN_KEY };
    for (const resource of ["messages", "offers", "products", "sources", "audit"]) {
      await request(context.app.getHttpServer())
        .get(`/v1/admin/${resource}`)
        .set(headers)
        .expect(200)
        .expect(({ body }) => expect(body.items).toBeInstanceOf(Array));
    }
    const id = "00000000-0000-4000-8000-000000000001";
    const justification = "Correção baseada na revisão da mensagem original";
    await request(context.app.getHttpServer())
      .put(`/v1/admin/messages/${id}/correction`)
      .set(headers)
      .send({ justification, changes: { coupon: "GPU" } })
      .expect(200);
    await request(context.app.getHttpServer())
      .post(`/v1/admin/offers/${id}/merge`)
      .set(headers)
      .send({ justification, sourceOfferIds: ["00000000-0000-4000-8000-000000000002"] })
      .expect(201);
    await request(context.app.getHttpServer())
      .post(`/v1/admin/offers/${id}/split`)
      .set(headers)
      .send({ justification, mentionIds: ["00000000-0000-4000-8000-000000000003"] })
      .expect(201);
    await request(context.app.getHttpServer())
      .post("/v1/admin/aliases")
      .set(headers)
      .send({ justification, productId: id, alias: "RTX4060" })
      .expect(201);
    await request(context.app.getHttpServer())
      .put(`/v1/admin/sources/${id}/block`)
      .set(headers)
      .send({ justification, blocked: true })
      .expect(200);
    await request(context.app.getHttpServer())
      .put(`/v1/admin/stores/${id}/block`)
      .set(headers)
      .send({ justification, blocked: false })
      .expect(200);
  });
});
