import { mapTelegramMessage } from "./telegram-message.js";
import type { TelegramMessageLike } from "./telegram-message.js";
import type { TelegramIngestQueue } from "./telegram-queue.js";

export type { TelegramMessageLike } from "./telegram-message.js";

export interface ResolvedTelegramChat {
  reference: string;
  peerId: string;
  title?: string;
  username?: string;
}

export interface TelegramClientPort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  resolveChat(reference: string): Promise<ResolvedTelegramChat>;
  onNewMessage(
    peerIds: string[],
    handler: (message: TelegramMessageLike) => Promise<void>
  ): () => void;
  listMessages(
    chat: ResolvedTelegramChat,
    input: { minId?: string; limit?: number }
  ): Promise<TelegramMessageLike[]>;
}

export interface TelegramCursorStore {
  get(peerId: string): Promise<string | null>;
}

export interface TelegramCollectorLogger {
  error(value: string): void;
}

export interface TelegramCollectorOptions {
  client: TelegramClientPort;
  queue: TelegramIngestQueue;
  chats: string[];
  initialHistoryLimit: number;
  cursors: TelegramCursorStore;
  logger?: TelegramCollectorLogger;
}

export class TelegramCollector {
  private readonly allowedPeerIds = new Map<string, ResolvedTelegramChat>();
  private removeHandler: (() => void) | undefined;

  constructor(private readonly options: TelegramCollectorOptions) {}

  async start(): Promise<void> {
    await this.stop();
    await this.options.client.connect();
    const chats = await Promise.all(
      this.options.chats.map((reference) => this.options.client.resolveChat(reference))
    );
    const cursors = new Map<string, string | null>();
    for (const chat of chats) {
      this.allowedPeerIds.set(chat.peerId, chat);
      cursors.set(chat.peerId, await this.options.cursors.get(chat.peerId));
    }

    this.removeHandler = this.options.client.onNewMessage(
      chats.map(({ peerId }) => peerId),
      async (message) => {
        const peerId = String(message.peerId);
        const chat = this.allowedPeerIds.get(peerId);
        if (!chat) return;
        await this.enqueue(message, chat, true);
      }
    );

    for (const chat of chats) {
      const cursor = cursors.get(chat.peerId) ?? null;
      if (cursor === null && this.options.initialHistoryLimit === 0) continue;
      const history = await this.options.client.listMessages(
        chat,
        cursor === null ? { limit: this.options.initialHistoryLimit } : { minId: cursor }
      );
      history.sort((left, right) => compareMessageIds(left.id, right.id));
      for (const message of history) await this.enqueue(message, chat, cursor !== null);
    }
  }

  async stop(): Promise<void> {
    this.removeHandler?.();
    this.removeHandler = undefined;
    this.allowedPeerIds.clear();
    await this.options.client.disconnect();
  }

  private async enqueue(
    message: TelegramMessageLike,
    chat: ResolvedTelegramChat,
    notifyEligible: boolean
  ): Promise<void> {
    try {
      await this.options.queue.add(
        mapTelegramMessage(message, {
          notifyEligible,
          ...(chat.title ? { chatTitle: chat.title } : {}),
          ...(chat.username ? { chatUsername: chat.username } : {})
        })
      );
    } catch (error) {
      this.options.logger?.error(`Telegram message could not be queued error=${errorName(error)}`);
    }
  }
}

function compareMessageIds(left: unknown, right: unknown): number {
  const leftId = BigInt(String(left));
  const rightId = BigInt(String(right));
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
