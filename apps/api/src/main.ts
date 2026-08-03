import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { ApiModule } from "./api.module.js";
import { configureApiApp } from "./configure-app.js";
import { PostgresApiRepository } from "./postgres-repository.js";

const adminKey = process.env.ADMIN_API_KEY;
if (!adminKey) throw new Error("ADMIN_API_KEY is required");
const repository = new PostgresApiRepository();
const app = await NestFactory.create<NestExpressApplication>(
  ApiModule.register({ repository, adminKey })
);
configureApiApp(app);
app.useBodyParser("json", { limit: "5mb" });
app.enableShutdownHooks();
await app.listen(Number(process.env.API_PORT ?? 3000), "0.0.0.0");
