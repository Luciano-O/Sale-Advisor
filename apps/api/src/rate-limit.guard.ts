import { createHash } from "node:crypto";

import { HttpException, HttpStatus } from "@nestjs/common";
import type { CanActivate, ExecutionContext, OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitStore {
  increment(key: string, windowSeconds: number): Promise<number>;
  close?(): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();
  get size() {
    return this.counters.size;
  }
  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + windowSeconds * 1_000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: Redis;
  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  }
  async increment(key: string, windowSeconds: number): Promise<number> {
    const value = await this.client.eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count",
      1,
      key,
      String(windowSeconds)
    );
    return Number(value);
  }
  async close() {
    await this.client.quit();
  }
}

export class RateLimitGuard implements CanActivate, OnApplicationShutdown {
  constructor(
    private readonly store: RateLimitStore,
    private readonly options: RateLimitOptions
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      route?: { path?: string };
    }>();
    const route = request.route?.path ?? "unknown";
    if (route.startsWith("/v1/health")) return true;
    const identity = request.ip ?? request.socket?.remoteAddress ?? "unknown";
    const identityHash = createHash("sha256").update(identity).digest("hex");
    let count: number;
    try {
      count = await this.store.increment(
        `rate-limit:${route}:${identityHash}`,
        this.options.windowSeconds
      );
    } catch {
      throw new HttpException({ message: "service_unavailable" }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (count > this.options.limit) {
      http
        .getResponse<{ setHeader(name: string, value: string): void }>()
        .setHeader("Retry-After", String(this.options.windowSeconds));
      throw new HttpException({ message: "rate_limit_exceeded" }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  async onApplicationShutdown() {
    await this.store.close?.();
  }
}
