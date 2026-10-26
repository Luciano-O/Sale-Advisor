import { Injectable } from "@nestjs/common";
import type { OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { JsonStructuredLogger } from "@sale-advisor/shared";

import { PersistentPipelineService } from "./persistent-pipeline.js";

const EXPIRY_INTERVAL_MS = 10 * 60 * 1_000;
const logger = new JsonStructuredLogger("worker", "info");

/** Periodically removes offers without a recent mention from the feed. */
@Injectable()
export class OfferExpiryScheduler implements OnModuleInit, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly pipeline: PersistentPipelineService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), EXPIRY_INTERVAL_MS);
    void this.run();
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.pipeline.expireStaleOffers();
      if (expired > 0) logger.info("offers.expired", { count: expired });
    } catch (error) {
      logger.error("offers.expiry_failed", {
        error: error instanceof Error ? error.name : "UnknownError"
      });
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
