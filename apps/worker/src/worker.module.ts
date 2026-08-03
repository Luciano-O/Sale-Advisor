import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { readWorkerConfig } from "@sale-advisor/config";

import { createNotificationProvider, NOTIFICATION_PROVIDER } from "./notification.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";
import {
  ConsolidateProcessor,
  NotifyProcessor,
  ParseProcessor,
  ResolveUrlProcessor,
  ScoreProcessor
} from "./processors.js";
import { PIPELINE_QUEUES } from "./queue-config.js";
import { TelegramCollectorLifecycle } from "./telegram-collector-lifecycle.js";
import { PostgresTelegramIngestRepository, TelegramIngestService } from "./telegram-ingest.js";
import { TelegramIngestProcessor } from "./telegram-processor.js";
import { TELEGRAM_INGEST_QUEUE } from "./telegram-queue.js";

const runtimeConfig = readWorkerConfig();

function redisConnection() {
  const url = new URL(runtimeConfig.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {})
  };
}

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection(), defaultJobOptions: { attempts: 5 } }),
    ...[TELEGRAM_INGEST_QUEUE, ...PIPELINE_QUEUES].map((name) => BullModule.registerQueue({ name }))
  ],
  providers: [
    {
      provide: NOTIFICATION_PROVIDER,
      useFactory: () =>
        createNotificationProvider({ NOTIFICATION_PROVIDER: runtimeConfig.notificationProvider })
    },
    {
      provide: PersistentPipelineService,
      inject: [NOTIFICATION_PROVIDER],
      useFactory: (provider: ReturnType<typeof createNotificationProvider>) =>
        new PersistentPipelineService(provider)
    },
    PostgresTelegramIngestRepository,
    {
      provide: TelegramIngestService,
      inject: [PostgresTelegramIngestRepository],
      useFactory: (repository: PostgresTelegramIngestRepository) =>
        new TelegramIngestService(repository)
    },
    TelegramCollectorLifecycle,
    TelegramIngestProcessor,
    OutboxDispatcher,
    ResolveUrlProcessor,
    ParseProcessor,
    ConsolidateProcessor,
    ScoreProcessor,
    NotifyProcessor
  ]
})
export class WorkerModule {}
