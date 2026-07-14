import { HttpException, HttpStatus } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly options: RateLimitOptions) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      route?: { path?: string };
    }>();
    const key = `${request.ip ?? request.socket?.remoteAddress ?? "unknown"}:${request.route?.path ?? "unknown"}`;
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return true;
    }
    if (current.count >= this.options.limit) {
      throw new HttpException("rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    current.count += 1;
    return true;
  }
}
