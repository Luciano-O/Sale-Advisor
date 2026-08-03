import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { readWorkerConfig } from "@sale-advisor/config";
import { JsonStructuredLogger, NestCompatibleJsonLogger } from "@sale-advisor/shared";

import { WorkerModule } from "./worker.module.js";

const config = readWorkerConfig();
const logger = new JsonStructuredLogger("worker", config.logLevel);
const app = await NestFactory.createApplicationContext(WorkerModule, {
  logger: new NestCompatibleJsonLogger(logger)
});
app.enableShutdownHooks();
