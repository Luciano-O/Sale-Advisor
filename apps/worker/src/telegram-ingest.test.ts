import { describe, expect, it } from "vitest";

import { InMemoryTelegramIngestRepository, TelegramIngestService } from "./telegram-ingest.js";
import type { TelegramIngestJobData } from "./telegram-queue.js";

function job(overrides: Partial<TelegramIngestJobData> = {}): TelegramIngestJobData {
  return {
    peerId: "-1001234567890",
    messageId: "42",
    senderId: "7",
    text: "RTX 4060 R$ 1.899 https://shop.example/gpu",
    capturedAt: "2026-07-30T12:00:00.000Z",
    urls: ["https://shop.example/gpu", "https://t.me/ofertas"],
    notifyEligible: true,
    chatTitle: "Ofertas",
    chatUsername: "ofertas",
    originalPayload: {
      id: 42,
      peerId: "-1001234567890",
      capturedUrls: ["https://shop.example/gpu", "https://t.me/ofertas"]
    },
    ...overrides
  };
}

describe("TelegramIngestService", () => {
  it("persists raw payload, selected URL and outbox exactly once on replay", async () => {
    const repository = new InMemoryTelegramIngestRepository();
    const service = new TelegramIngestService(repository);

    const first = await service.ingest(job());
    const replay = await service.ingest(job());

    expect(replay.rawMessageId).toBe(first.rawMessageId);
    expect(replay.inserted).toBe(false);
    expect(repository.sources).toEqual([
      expect.objectContaining({ name: "telegram:-1001234567890", kind: "telegram" })
    ]);
    expect(repository.rawMessages).toEqual([
      expect.objectContaining({
        externalId: "42",
        text: job().text,
        suppliedUrl: "https://shop.example/gpu",
        notifyEligible: true,
        originalPayload: job().originalPayload
      })
    ]);
    expect(repository.outbox).toHaveLength(1);
  });

  it("uses peer and message ids in a source-independent deterministic idempotency key", async () => {
    const repository = new InMemoryTelegramIngestRepository();
    const service = new TelegramIngestService(repository);

    await service.ingest(job());
    await service.ingest(job({ messageId: "43" }));

    expect(repository.rawMessages).toHaveLength(2);
    expect(repository.rawMessages[0]?.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.rawMessages[0]?.idempotencyKey).not.toBe(
      repository.rawMessages[1]?.idempotencyKey
    );
  });
});
