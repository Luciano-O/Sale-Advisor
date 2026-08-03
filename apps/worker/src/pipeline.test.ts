import { describe, expect, it } from "vitest";

import {
  createNotificationProvider,
  FakeNotificationProvider,
  FcmNotificationProvider
} from "./notification.js";
import { DEFAULT_JOB_OPTIONS, deterministicJobId } from "./queue-config.js";
import { InMemoryWorkerRepository, WorkerPipeline } from "./pipeline.js";

function setup() {
  const repository = new InMemoryWorkerRepository();
  const notifications = new FakeNotificationProvider();
  return { repository, notifications, pipeline: new WorkerPipeline(repository, notifications) };
}

describe("persistent worker pipeline", () => {
  it("configures five attempts with exponential backoff", () => {
    expect(DEFAULT_JOB_OPTIONS).toMatchObject({ attempts: 5, backoff: { type: "exponential" } });
    expect(deterministicJobId("parse", "message", 2)).toBe("parse-message-2");
  });

  it("uses fake notifications by default and enables FCM only explicitly", async () => {
    const fake = createNotificationProvider({});
    expect(fake).toBeInstanceOf(FakeNotificationProvider);
    await fake.send({ installationId: "device", token: null }, { offerId: "offer" });
    expect((fake as FakeNotificationProvider).deliveries).toHaveLength(1);
    expect(createNotificationProvider({ NOTIFICATION_PROVIDER: "fcm" })).toBeInstanceOf(
      FcmNotificationProvider
    );
    await expect(
      new FcmNotificationProvider().send(
        { installationId: "device", token: null },
        { offerId: "offer" }
      )
    ).rejects.toThrow(/target/i);
  });

  it("processes and replays a message idempotently", async () => {
    const { repository, pipeline } = setup();
    const id = repository.addRawMessage({
      text: "RTX 4060 8GB por R$ 1.899 no Pix",
      capturedAt: "2026-07-14T12:00:00.000Z",
      storeDomain: "shop.example",
      notifyEligible: false
    });
    await pipeline.processRawMessage(id);
    const scoreCount = repository.scores.length;
    await pipeline.processRawMessage(id);
    expect(repository.parses).toHaveLength(1);
    expect(repository.offers).toHaveLength(1);
    expect(repository.mentions).toHaveLength(1);
    expect(repository.snapshots).toHaveLength(1);
    expect(repository.scores).toHaveLength(scoreCount);
  });

  it("serializes concurrent consolidation for the same fingerprints", async () => {
    const { repository, pipeline } = setup();
    const first = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.901 Pix cupom GPU",
      capturedAt: "2026-07-14T10:00:00.000Z",
      storeDomain: "shop.example",
      notifyEligible: false
    });
    const second = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.949 Pix cupom GPU",
      capturedAt: "2026-07-14T11:00:00.000Z",
      storeDomain: "shop.example",
      notifyEligible: false
    });
    await Promise.all([pipeline.processRawMessage(first), pipeline.processRawMessage(second)]);
    expect(repository.offers).toHaveLength(1);
    expect(repository.mentions).toHaveLength(2);
    expect(repository.snapshots.map((item) => item.amountInCents)).toEqual([190100, 194900]);
  });

  it("keeps partial failures replayable without blocking valid outbox work", async () => {
    const { repository, pipeline } = setup();
    const partial = repository.addRawMessage({
      text: "Oferta sem dados",
      capturedAt: "2026-07-14T10:00:00.000Z",
      notifyEligible: false
    });
    const valid = repository.addRawMessage({
      text: "RX 7600 8GB R$ 1.500 Pix",
      capturedAt: "2026-07-14T11:00:00.000Z",
      storeDomain: "shop.example",
      notifyEligible: false
    });
    await pipeline.dispatchOutbox();
    expect(repository.rawMessages.find((item) => item.id === partial)?.status).toBe("partial");
    expect(repository.rawMessages.find((item) => item.id === valid)?.status).toBe("completed");
    expect(repository.outbox.every((item) => item.publishedAt)).toBe(true);
  });

  it("processes imports chronologically and rescoring supports retroactive observations", async () => {
    const { repository, pipeline } = setup();
    const later = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.700 Pix",
      capturedAt: "2026-07-14T12:00:00.000Z",
      storeDomain: "shop.example",
      notifyEligible: false
    });
    const earlier = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 2.000 Pix",
      capturedAt: "2026-06-20T12:00:00.000Z",
      storeDomain: "shop.example",
      notifyEligible: false
    });
    await pipeline.processRawMessage(later);
    const initialScoreCount = repository.scores.length;
    await pipeline.processRawMessage(earlier);
    expect(repository.scores.length).toBeGreaterThan(initialScoreCount);
    expect(repository.scores.at(-1)?.offerId).toBe(
      repository.mentions.find((item) => item.rawMessageId === later)?.offerId
    );
  });

  it("delivers an eligible consolidated offer at most once per installation", async () => {
    const { repository, notifications, pipeline } = setup();
    repository.addInstallation({ id: "device", minimumLabel: "normal" });
    const id = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.899 Pix",
      capturedAt: new Date().toISOString(),
      storeDomain: "shop.example",
      notifyEligible: true
    });
    await pipeline.processRawMessage(id);
    await pipeline.notifyForMessage(id);
    await pipeline.notifyForMessage(id);
    expect(notifications.deliveries).toHaveLength(1);
    expect(repository.deliveries).toHaveLength(1);
    expect(notifications.deliveries[0]?.payload).toEqual({ offerId: repository.offers[0]?.id });
  });
});
