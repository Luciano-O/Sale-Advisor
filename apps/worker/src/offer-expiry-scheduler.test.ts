import "reflect-metadata";

import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { OfferExpiryScheduler } from "./offer-expiry-scheduler.js";
import { PersistentPipelineService } from "./persistent-pipeline.js";

describe("OfferExpiryScheduler", () => {
  it("expires stale offers when resolved through Nest dependency injection", async () => {
    const expireStaleOffers = vi.fn(async () => 2);

    @Module({
      providers: [
        OfferExpiryScheduler,
        { provide: PersistentPipelineService, useValue: { expireStaleOffers } }
      ]
    })
    class TestModule {}

    const app = await NestFactory.createApplicationContext(TestModule, { logger: false });
    try {
      await app.get(OfferExpiryScheduler).run();
      expect(expireStaleOffers).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
