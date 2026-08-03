import { describe, expect, it } from "vitest";

import { TelegramCollector } from "./telegram-collector.js";
import type {
  ResolvedTelegramChat,
  TelegramClientPort,
  TelegramMessageLike
} from "./telegram-collector.js";
import type { TelegramIngestJobData, TelegramIngestQueue } from "./telegram-queue.js";

class FakeTelegramClient implements TelegramClientPort {
  readonly operations: string[] = [];
  readonly historyRequests: Array<{ peerId: string; minId?: string; limit?: number }> = [];
  private handler?: (message: TelegramMessageLike) => Promise<void>;

  constructor(
    private readonly chats: Record<string, ResolvedTelegramChat>,
    private readonly histories: Record<string, TelegramMessageLike[]>
  ) {}

  async connect() {
    this.operations.push("connect");
  }

  async disconnect() {
    this.operations.push("disconnect");
  }

  async resolveChat(reference: string) {
    this.operations.push(`resolve:${reference}`);
    const chat = this.chats[reference];
    if (!chat) throw new Error(`Unknown chat ${reference}`);
    return chat;
  }

  onNewMessage(peerIds: string[], handler: (message: TelegramMessageLike) => Promise<void>) {
    this.operations.push(`listen:${peerIds.join(",")}`);
    this.handler = handler;
    return () => {
      this.operations.push("unlisten");
      this.handler = undefined;
    };
  }

  async listMessages(chat: ResolvedTelegramChat, input: { minId?: string; limit?: number }) {
    this.operations.push(`history:${chat.peerId}`);
    this.historyRequests.push({ peerId: chat.peerId, ...input });
    return this.histories[chat.peerId] ?? [];
  }

  async emit(message: TelegramMessageLike) {
    await this.handler?.(message);
  }
}

class FakeTelegramQueue implements TelegramIngestQueue {
  readonly jobs: TelegramIngestJobData[] = [];
  failMessageId?: string;

  async add(data: TelegramIngestJobData) {
    if (data.messageId === this.failMessageId) throw new Error("queue unavailable");
    this.jobs.push(data);
  }
}

function message(peerId: string, id: number): TelegramMessageLike {
  return {
    id,
    peerId,
    message: `RTX 4060 R$ 1.899 https://shop.example/${id}`,
    date: new Date(`2026-07-30T12:${String(id).padStart(2, "0")}:00.000Z`),
    entities: [],
    toJSON: () => ({ id, peerId })
  };
}

describe("TelegramCollector", () => {
  it("registers live collection before initial history and disables initial notifications", async () => {
    const client = new FakeTelegramClient(
      { "@gpu": { reference: "@gpu", peerId: "-1001", title: "GPU" } },
      { "-1001": [message("-1001", 2), message("-1001", 1)] }
    );
    const queue = new FakeTelegramQueue();
    const collector = new TelegramCollector({
      client,
      queue,
      chats: ["@gpu"],
      initialHistoryLimit: 100,
      cursors: { get: async () => null }
    });

    await collector.start();

    expect(client.operations.indexOf("listen:-1001")).toBeLessThan(
      client.operations.indexOf("history:-1001")
    );
    expect(client.historyRequests).toEqual([{ peerId: "-1001", limit: 100 }]);
    expect(queue.jobs.map(({ messageId, notifyEligible }) => [messageId, notifyEligible])).toEqual([
      ["1", false],
      ["2", false]
    ]);
  });

  it("recovers messages after a persisted cursor and collects allowlisted live messages", async () => {
    const client = new FakeTelegramClient(
      { "@gpu": { reference: "@gpu", peerId: "-1001", title: "GPU" } },
      { "-1001": [message("-1001", 12), message("-1001", 11)] }
    );
    const queue = new FakeTelegramQueue();
    const collector = new TelegramCollector({
      client,
      queue,
      chats: ["@gpu"],
      initialHistoryLimit: 100,
      cursors: { get: async () => "10" }
    });

    await collector.start();
    await client.emit(message("-9999", 20));
    await client.emit(message("-1001", 13));

    expect(client.historyRequests).toEqual([{ peerId: "-1001", minId: "10" }]);
    expect(queue.jobs.map(({ messageId, notifyEligible }) => [messageId, notifyEligible])).toEqual([
      ["11", true],
      ["12", true],
      ["13", true]
    ]);
  });

  it("continues a history batch when one message cannot be queued", async () => {
    const client = new FakeTelegramClient(
      { "@gpu": { reference: "@gpu", peerId: "-1001" } },
      { "-1001": [message("-1001", 2), message("-1001", 1)] }
    );
    const queue = new FakeTelegramQueue();
    queue.failMessageId = "1";
    const errors: string[] = [];
    const collector = new TelegramCollector({
      client,
      queue,
      chats: ["@gpu"],
      initialHistoryLimit: 100,
      cursors: { get: async () => null },
      logger: { error: (value) => errors.push(value) }
    });

    await collector.start();

    expect(queue.jobs.map(({ messageId }) => messageId)).toEqual(["2"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe("Telegram message could not be queued error=Error");
    expect(errors[0]).not.toContain("-1001");
    expect(errors[0]).not.toContain("message=1");
  });
});
