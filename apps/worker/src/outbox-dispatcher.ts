import { Injectable } from "@nestjs/common";
import type { OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { createDatabase } from "@sale-advisor/database";
import type { Queue } from "bullmq";

import type { PipelineJobData } from "./processors.js";
import { DEFAULT_JOB_OPTIONS, deterministicJobId } from "./queue-config.js";

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnApplicationShutdown {
  private readonly connection = createDatabase();
  private timer?: ReturnType<typeof setInterval>;
  private dispatching = false;

  constructor(@InjectQueue("parse") private readonly parseQueue: Queue<PipelineJobData>) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.dispatch(), 1_000);
    void this.dispatch();
  }

  async dispatch() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const events = await this.connection.client<
        {
          id: string;
          aggregateId: string;
          version: number;
          correlationId: string;
        }[]
      >`
        select id, aggregate_id as "aggregateId", version, correlation_id as "correlationId"
        from outbox_events where topic = 'raw-message.created' and published_at is null
          and available_at <= now() order by created_at limit 100
      `;
      for (const event of events) {
        await this.parseQueue.add(
          "parse",
          {
            rawMessageId: event.aggregateId,
            version: event.version,
            correlationId: event.correlationId
          },
          {
            ...DEFAULT_JOB_OPTIONS,
            jobId: deterministicJobId("parse", event.aggregateId, event.version)
          }
        );
        await this.connection
          .client`update outbox_events set published_at = now(), attempts = attempts + 1 where id = ${event.id}`;
      }
    } finally {
      this.dispatching = false;
    }
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.connection.close();
  }
}
