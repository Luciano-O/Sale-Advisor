import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

import { DEFAULT_JOB_OPTIONS } from "./queue-config.js";
import { PostgresTelegramLeadershipStore } from "./postgres-telegram-leadership.js";
import { TelegramCollector } from "./telegram-collector.js";
import { readTelegramConfig } from "./telegram-config.js";
import { PostgresTelegramIngestRepository } from "./telegram-ingest.js";
import { TELEGRAM_INGEST_QUEUE, telegramIngestJobId } from "./telegram-queue.js";
import type { TelegramIngestJobData } from "./telegram-queue.js";
import { TelegramLeadershipCoordinator } from "./telegram-leadership.js";
import { classifyTelegramFailure, computeTelegramRetry } from "./telegram-operations.js";
import { TeleprotoTelegramClient } from "./teleproto-client.js";

@Injectable()
export class TelegramCollectorLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramCollectorLifecycle.name);
  private readonly config = readTelegramConfig();
  private readonly instanceId = process.env.WORKER_INSTANCE_ID?.trim() || randomUUID();
  private collector?: TelegramCollector;
  private leadership?: TelegramLeadershipCoordinator;
  private leadershipStore?: PostgresTelegramLeadershipStore;
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
          await this.recordHealthy(new Date());
        }
      },
      chats: this.config.chats,
      initialHistoryLimit: this.config.initialHistoryLimit,
      cursors: this.repository,
      logger: {
        error: (message) => this.logger.error(message)
      }
    });
    this.leadershipStore = new PostgresTelegramLeadershipStore();
    this.leadership = new TelegramLeadershipCoordinator(this.instanceId, this.leadershipStore, {
      onRoleChanged: async (active) => {
        if (active) await this.startCollector();
        else await this.collector?.stop();
      }
    });
    this.leadership.start();
  }

  private async startCollector(): Promise<void> {
    if (this.stopped || !this.collector) return;
    try {
      await this.collector.start();
      this.retryCount = 0;
      await this.recordHealthy();
      this.logger.log(
        `Telegram collection started chats=${this.config.enabled ? this.config.chats.length : 0}`
      );
    } catch (error) {
      this.retryCount += 1;
      const failure = classifyTelegramFailure(error);
      const delay = computeTelegramRetry(failure, this.retryCount);
      const now = new Date();
      await this.leadershipStore?.update(this.instanceId, {
        role: "active",
        heartbeatAt: now,
        state: delay === null ? "blocked" : "retrying",
        retryCount: this.retryCount,
        nextRetryAt: delay === null ? null : new Date(now.getTime() + delay),
        lastError: { category: failure.category, ...failure.sanitizedError }
      });
      this.logger.error(
        `Telegram collection startup failed category=${failure.category} error=${failure.sanitizedError.name}` +
          (delay === null ? " state=blocked" : ` retryInMs=${delay}`)
      );
      if (delay !== null) this.retryTimer = setTimeout(() => void this.startCollector(), delay);
    }
  }

  private async recordHealthy(lastMessageAt?: Date) {
    await this.leadershipStore?.update(this.instanceId, {
      role: "active",
      heartbeatAt: new Date(),
      state: "healthy",
      ...(lastMessageAt ? { lastMessageAt } : {}),
      retryCount: 0,
      nextRetryAt: null,
      lastError: null
    });
  }

  async onApplicationShutdown() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    await this.leadership?.stop();
    await this.collector?.stop();
    await this.leadershipStore?.close();
  }
}
