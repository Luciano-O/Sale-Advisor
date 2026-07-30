import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

import { DEFAULT_JOB_OPTIONS } from "./queue-config.js";
import { TelegramCollector } from "./telegram-collector.js";
import { readTelegramConfig } from "./telegram-config.js";
import { PostgresTelegramIngestRepository } from "./telegram-ingest.js";
import { TELEGRAM_INGEST_QUEUE, telegramIngestJobId } from "./telegram-queue.js";
import type { TelegramIngestJobData } from "./telegram-queue.js";
import { TeleprotoTelegramClient } from "./teleproto-client.js";

@Injectable()
export class TelegramCollectorLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramCollectorLifecycle.name);
  private readonly config = readTelegramConfig();
  private collector?: TelegramCollector;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private retryCount = 0;

  constructor(
    @InjectQueue(TELEGRAM_INGEST_QUEUE)
    private readonly queue: Queue<TelegramIngestJobData>,
    @Inject(PostgresTelegramIngestRepository)
    private readonly repository: PostgresTelegramIngestRepository
  ) {}

  onModuleInit() {
    if (!this.config.enabled) {
      this.logger.log("Telegram collection is disabled");
      return;
    }
    this.collector = new TelegramCollector({
      client: new TeleprotoTelegramClient(this.config),
      queue: {
        add: async (data) => {
          await this.queue.add("telegram-message", data, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: telegramIngestJobId(data.peerId, data.messageId)
          });
        }
      },
      chats: this.config.chats,
      initialHistoryLimit: this.config.initialHistoryLimit,
      cursors: this.repository,
      logger: {
        error: (message) => this.logger.error(message)
      }
    });
    void this.startCollector();
  }

  private async startCollector(): Promise<void> {
    if (this.stopped || !this.collector) return;
    try {
      await this.collector.start();
      this.retryCount = 0;
      this.logger.log(
        `Telegram collection started chats=${this.config.enabled ? this.config.chats.length : 0}`
      );
    } catch (error) {
      this.retryCount += 1;
      const delay = Math.min(2 ** (this.retryCount - 1) * 1_000, 60_000);
      this.logger.error(
        `Telegram collection startup failed error=${errorName(error)} retryInMs=${delay}`
      );
      this.retryTimer = setTimeout(() => void this.startCollector(), delay);
    }
  }

  async onApplicationShutdown() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    await this.collector?.stop();
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
