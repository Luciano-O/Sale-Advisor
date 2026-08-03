import { createHash } from "node:crypto";

export const TELEGRAM_INGEST_QUEUE = "telegram-ingest";

export interface TelegramIngestJobData {
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

export interface TelegramIngestQueue {
  add(data: TelegramIngestJobData): Promise<void>;
}

export function telegramIngestJobId(peerId: string, messageId: string): string {
  const digest = createHash("sha256").update(`${peerId}:${messageId}`).digest("hex");
  return `${TELEGRAM_INGEST_QUEUE}-${digest}`;
}
