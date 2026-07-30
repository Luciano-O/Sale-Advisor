import { Inject } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

import { TelegramIngestService } from "./telegram-ingest.js";
import { TELEGRAM_INGEST_QUEUE } from "./telegram-queue.js";
import type { TelegramIngestJobData } from "./telegram-queue.js";

@Processor(TELEGRAM_INGEST_QUEUE)
export class TelegramIngestProcessor extends WorkerHost {
  constructor(@Inject(TelegramIngestService) private readonly ingest: TelegramIngestService) {
    super();
  }

  async process(job: Job<TelegramIngestJobData>) {
    return this.ingest.ingest(job.data);
  }
}
