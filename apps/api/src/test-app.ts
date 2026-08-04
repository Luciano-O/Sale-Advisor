import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { ApiModule } from "./api.module.js";
import { configureApiApp } from "./configure-app.js";
import { InMemoryApiRepository } from "./repository.js";

export interface ApiTestContext {
  app: NestExpressApplication;
  repository: InMemoryApiRepository;
}

export async function createApiTestApp(options: { adminKey: string }): Promise<ApiTestContext> {
  const repository = new InMemoryApiRepository();
  const module = await Test.createTestingModule({
    imports: [ApiModule.register({ repository, adminKey: options.adminKey })]
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>();
  configureApiApp(app);
  await app.init();
  return { app, repository };
}
