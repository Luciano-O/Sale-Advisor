import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { readApiConfig } from "@sale-advisor/config";
import { JsonStructuredLogger, NestCompatibleJsonLogger } from "@sale-advisor/shared";

import { ApiModule } from "./api.module.js";
import { configureApiApp } from "./configure-app.js";
import { PostgresApiRepository } from "./postgres-repository.js";
import { RedisRateLimitStore } from "./rate-limit.guard.js";

const config = readApiConfig();
const structuredLogger = new JsonStructuredLogger("api", config.logLevel);
const repository = new PostgresApiRepository();
const app = await NestFactory.create<NestExpressApplication>(
  ApiModule.register({
    repository,
    adminKey: config.adminApiKey,
    rateLimitStore: new RedisRateLimitStore(config.redisUrl),
    rateLimitOptions: {
      limit: config.rateLimitMax,
      windowSeconds: config.rateLimitWindowSeconds
    }
  }),
  { logger: new NestCompatibleJsonLogger(structuredLogger) }
);
configureApiApp(app, {
  corsAllowedOrigins: config.corsAllowedOrigins,
  trustProxyHops: config.trustProxyHops,
  logger: structuredLogger
});
app.useBodyParser("json", { limit: "5mb" });
app.enableShutdownHooks();
await app.listen(config.apiPort, "0.0.0.0");
