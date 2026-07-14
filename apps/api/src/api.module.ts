import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AdminKeyGuard } from "./admin-key.guard.js";
import {
  AdminController,
  EventsController,
  HealthController,
  InstallationsController,
  OffersController
} from "./controllers.js";
import { ADMIN_API_KEY, API_REPOSITORY, type ApiRepository } from "./repository.js";
import { RateLimitGuard } from "./rate-limit.guard.js";

export interface ApiModuleOptions {
  repository: ApiRepository;
  adminKey: string;
}

@Module({})
export class ApiModule {
  static register(options: ApiModuleOptions): DynamicModule {
    if (options.adminKey.length < 32)
      throw new Error("ADMIN_API_KEY must have at least 32 characters");
    return {
      module: ApiModule,
      controllers: [
        HealthController,
        AdminController,
        OffersController,
        InstallationsController,
        EventsController
      ],
      providers: [
        AdminKeyGuard,
        {
          provide: APP_GUARD,
          useFactory: () => new RateLimitGuard({ limit: 120, windowMs: 60_000 })
        },
        { provide: API_REPOSITORY, useValue: options.repository },
        { provide: ADMIN_API_KEY, useValue: options.adminKey }
      ]
    };
  }
}
