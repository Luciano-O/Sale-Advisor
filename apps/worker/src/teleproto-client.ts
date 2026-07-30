import { events, sessions, TelegramClient, utils } from "teleproto";

import type {
  ResolvedTelegramChat,
  TelegramClientPort,
  TelegramMessageLike
} from "./telegram-collector.js";
import type { TelegramConfig } from "./telegram-config.js";

type EnabledTelegramConfig = Extract<TelegramConfig, { enabled: true }>;
const { NewMessage } = events;
const { StringSession } = sessions;

export class TeleprotoTelegramClient implements TelegramClientPort {
  private readonly client: TelegramClient;

  constructor(config: EnabledTelegramConfig) {
    this.client = new TelegramClient(
      new StringSession(config.session),
      config.apiId,
      config.apiHash,
      {
        autoReconnect: true,
        connectionRetries: 5,
        reconnectRetries: 5,
        retryDelay: 1_000,
        sequentialUpdates: true
      }
    );
  }

  async connect(): Promise<void> {
    await this.client.connect();
    if (!(await this.client.isUserAuthorized())) {
      await this.client.disconnect();
      throw new Error("Telegram session is not authorized; generate a new TELEGRAM_SESSION");
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async resolveChat(reference: string): Promise<ResolvedTelegramChat> {
    const entity = await this.client.getEntity(reference);
    const details = entity as unknown as { title?: string; username?: string };
    return {
      reference,
      peerId: utils.getPeerId(entity).toString(),
      ...(details.title ? { title: details.title } : {}),
      ...(details.username ? { username: details.username } : {})
    };
  }

  onNewMessage(
    peerIds: string[],
    handler: (message: TelegramMessageLike) => Promise<void>
  ): () => void {
    const allowed = new Set(peerIds);
    const builder = new NewMessage({ incoming: true });
    const eventHandler = async (event: events.NewMessageEvent) => {
      const mapped = toMessageLike(event.message, event.chatId?.toString());
      if (!allowed.has(String(mapped.peerId))) return;
      await handler(mapped);
    };
    this.client.addEventHandler(eventHandler, builder);
    return () => this.client.removeEventHandler(eventHandler, builder);
  }

  async listMessages(
    chat: ResolvedTelegramChat,
    input: { minId?: string; limit?: number }
  ): Promise<TelegramMessageLike[]> {
    const messages = await this.client.getMessages(chat.reference, {
      ...(input.minId ? { minId: Number(input.minId) } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {})
    });
    return Array.from(messages, (message) => toMessageLike(message, chat.peerId));
  }
}

function toMessageLike(
  message: {
    id: number;
    senderId?: unknown;
    message?: string;
    date: number;
    entities?: unknown[];
    originalArgs?: unknown;
  },
  peerId?: string
): TelegramMessageLike {
  if (!peerId) throw new Error("Telegram message does not include a peer id");
  return {
    id: message.id,
    peerId,
    message: message.message ?? "",
    date: message.date,
    entities: (message.entities ?? []) as NonNullable<TelegramMessageLike["entities"]>,
    toJSON: () =>
      message.originalArgs ?? {
        id: message.id,
        message: message.message ?? "",
        date: message.date
      },
    ...(message.senderId === undefined ? {} : { senderId: message.senderId })
  };
}
