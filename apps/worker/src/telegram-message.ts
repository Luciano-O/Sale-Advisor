import { extractHttpUrls } from "@sale-advisor/domain";

export interface TelegramEntityLike {
  className?: string;
  offset?: number;
  length?: number;
  url?: string;
  [key: string]: unknown;
}

export interface TelegramMessageLike {
  id: unknown;
  peerId: unknown;
  senderId?: unknown;
  message?: string;
  date: Date | number;
  entities?: TelegramEntityLike[];
  toJSON?: () => unknown;
}

export interface MapTelegramMessageContext {
  chatTitle?: string;
  chatUsername?: string;
  notifyEligible: boolean;
}

export interface MappedTelegramMessage {
  peerId: string;
  messageId: string;
  senderId: string | null;
  text: string;
  capturedAt: string;
  urls: string[];
  notifyEligible: boolean;
  chatTitle: string | null;
  chatUsername: string | null;
  originalPayload: Record<string, unknown>;
}

export function mapTelegramMessage(
  message: TelegramMessageLike,
  context: MapTelegramMessageContext
): MappedTelegramMessage {
  const text = message.message ?? "";
  const entityUrls = (message.entities ?? []).flatMap((entity) => {
    if (entity.className === "MessageEntityTextUrl" && entity.url) return [entity.url];
    if (
      entity.className === "MessageEntityUrl" &&
      typeof entity.offset === "number" &&
      typeof entity.length === "number"
    ) {
      return [text.slice(entity.offset, entity.offset + entity.length)];
    }
    return [];
  });
  const urls = Array.from(new Set([...extractHttpUrls(text), ...entityUrls])).filter(Boolean);
  const serialized = serializeTelegramValue(message.toJSON?.() ?? message);
  const raw =
    typeof serialized === "object" && serialized !== null && !Array.isArray(serialized)
      ? serialized
      : { value: serialized };
  const peerId = stringifyTelegramId(message.peerId, "peerId");
  const messageId = stringifyTelegramId(message.id, "messageId");

  return {
    peerId,
    messageId,
    senderId:
      message.senderId === undefined || message.senderId === null
        ? null
        : stringifyTelegramId(message.senderId, "senderId"),
    text,
    capturedAt: serializeTelegramDate(message.date),
    urls,
    notifyEligible: context.notifyEligible,
    chatTitle: context.chatTitle ?? null,
    chatUsername: context.chatUsername ?? null,
    originalPayload: {
      ...raw,
      peerId,
      capturedUrls: urls,
      collector: {
        kind: "telegram",
        chatTitle: context.chatTitle ?? null,
        chatUsername: context.chatUsername ?? null
      }
    }
  };
}

export function serializeTelegramValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map((item) => serializeTelegramValue(item, seen));
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  const candidate = value as Record<string, unknown> & {
    toJSON?: () => unknown;
    toString?: () => string;
  };
  const stringValue = candidate.toString?.();
  if (
    stringValue &&
    /^-?\d+$/.test(stringValue) &&
    (Object.hasOwn(candidate, "toString") || Object.getPrototypeOf(candidate) !== Object.prototype)
  ) {
    return stringValue;
  }
  if (typeof candidate.toJSON === "function") {
    const json = candidate.toJSON();
    if (json !== value) return serializeTelegramValue(json, seen);
  }

  return Object.fromEntries(
    Object.entries(candidate).map(([key, item]) => [key, serializeTelegramValue(item, seen)])
  );
}

function stringifyTelegramId(value: unknown, label: string): string {
  const serialized = serializeTelegramValue(value);
  const result =
    typeof serialized === "string" || typeof serialized === "number"
      ? String(serialized)
      : String(value);
  if (!/^-?\d+$/.test(result)) throw new Error(`Telegram ${label} must be numeric`);
  return result;
}

function serializeTelegramDate(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value * 1_000);
  if (Number.isNaN(date.getTime())) throw new Error("Telegram message date is invalid");
  return date.toISOString();
}
