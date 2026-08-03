import { describe, expect, it } from "vitest";

import {
  createNotificationProvider,
  FakeNotificationProvider,
  FcmNotificationProvider,
  NotificationSendError
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
    ).rejects.toMatchObject({ code: "messaging/missing-token", retryable: false });
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

  it("retries a transient notification failure and preserves one delivery record", async () => {
    const repository = new InMemoryWorkerRepository();
    let attempts = 0;
    const notifications = {
      name: "fcm" as const,
      async send() {
        attempts += 1;
        if (attempts === 1) throw new NotificationSendError("messaging/internal-error", true);
      }
    };
    const pipeline = new WorkerPipeline(repository, notifications);
    repository.addInstallation({ id: "device", minimumLabel: "normal", token: "token" });
    const id = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.899 Pix",
      capturedAt: new Date().toISOString(),
      storeDomain: "shop.example",
      notifyEligible: true
    });

    await expect(pipeline.processRawMessage(id)).rejects.toThrow(/internal-error/);
    expect(repository.deliveries).toMatchObject([
      { status: "failed", attempts: 1, error: "messaging/internal-error" }
    ]);

    await pipeline.notifyForMessage(id);
    expect(attempts).toBe(2);
    expect(repository.deliveries).toMatchObject([{ status: "sent", attempts: 2, error: null }]);
  });

  it("disables a permanently invalid token without blocking other recipients", async () => {
    const repository = new InMemoryWorkerRepository();
    const sentTo: string[] = [];
    const notifications = {
      name: "fcm" as const,
      async send(target: { installationId: string }) {
        if (target.installationId === "invalid")
          throw new NotificationSendError("messaging/registration-token-not-registered", false);
        sentTo.push(target.installationId);
      }
    };
    const pipeline = new WorkerPipeline(repository, notifications);
    repository.addInstallation({ id: "invalid", minimumLabel: "normal", token: "bad-token" });
    repository.addInstallation({ id: "valid", minimumLabel: "normal", token: "good-token" });
    const id = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.899 Pix",
      capturedAt: new Date().toISOString(),
      storeDomain: "shop.example",
      notifyEligible: true
    });

    await pipeline.processRawMessage(id);

    expect(repository.installations.find((item) => item.id === "invalid")?.token).toBeNull();
    expect(repository.deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ installationId: "invalid", status: "failed", attempts: 1 }),
        expect.objectContaining({ installationId: "valid", status: "sent", attempts: 1 })
      ])
    );
    expect(sentTo).toEqual(["valid"]);
  });

  it("attempts every recipient before surfacing transient failures", async () => {
    const repository = new InMemoryWorkerRepository();
    const attempted: string[] = [];
    const notifications = {
      name: "fcm" as const,
      async send(target: { installationId: string }) {
        attempted.push(target.installationId);
        if (target.installationId === "first")
          throw new NotificationSendError("messaging/server-unavailable", true);
      }
    };
    const pipeline = new WorkerPipeline(repository, notifications);
    repository.addInstallation({ id: "first", minimumLabel: "normal", token: "one" });
    repository.addInstallation({ id: "second", minimumLabel: "normal", token: "two" });
    const id = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.899 Pix",
      capturedAt: new Date().toISOString(),
      storeDomain: "shop.example",
      notifyEligible: true
    });

    await expect(pipeline.processRawMessage(id)).rejects.toThrow(/server-unavailable/);
    expect(attempted).toEqual(["first", "second"]);
    expect(repository.deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ installationId: "first", status: "failed" }),
        expect.objectContaining({ installationId: "second", status: "sent" })
      ])
    );
  });

  it("claims a notification before sending so concurrent retries do not duplicate it", async () => {
    const repository = new InMemoryWorkerRepository();
    let sends = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const notifications = {
      name: "fcm" as const,
      async send() {
        sends += 1;
        await gate;
      }
    };
    const pipeline = new WorkerPipeline(repository, notifications);
    repository.addInstallation({ id: "device", minimumLabel: "normal", token: "token" });
    const id = repository.addRawMessage({
      text: "RTX 4060 8GB R$ 1.899 Pix",
      capturedAt: new Date().toISOString(),
      storeDomain: "shop.example",
      notifyEligible: false
    });
    await pipeline.processRawMessage(id);
    const raw = repository.rawMessages.find((item) => item.id === id);
    if (!raw) throw new Error("test raw message not found");
    raw.notifyEligible = true;

    const first = pipeline.notifyForMessage(id);
    const concurrent = pipeline.notifyForMessage(id);
    await Promise.resolve();
    release();
    await Promise.all([first, concurrent]);

    expect(sends).toBe(1);
    expect(repository.deliveries).toMatchObject([{ status: "sent", attempts: 1 }]);
  });
});
