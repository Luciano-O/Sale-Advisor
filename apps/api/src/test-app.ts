import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { ApiModule } from "./api.module.js";
import { configureApiApp } from "./configure-app.js";
import { InMemoryApiRepository } from "./repository.js";

export interface ApiTestContext {
  app: INestApplication;
  repository: InMemoryApiRepository;
}

export async function createApiTestApp(options: { adminKey: string }): Promise<ApiTestContext> {
  const repository = new InMemoryApiRepository();
  const module = await Test.createTestingModule({
    imports: [ApiModule.register({ repository, adminKey: options.adminKey })]
  }).compile();
  const app = module.createNestApplication();
  configureApiApp(app);
  await app.init();
  return { app, repository };
}
