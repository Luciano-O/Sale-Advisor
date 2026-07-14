import { createHash, timingSafeEqual } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import { ADMIN_API_KEY } from "./repository.js";

@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(@Inject(ADMIN_API_KEY) private readonly expectedKey: string) {}

  canActivate(context: ExecutionContext): boolean {
    const supplied =
      context
        .switchToHttp()
        .getRequest<{ header(name: string): string | undefined }>()
        .header("x-admin-key") ?? "";
    const expectedHash = createHash("sha256").update(this.expectedKey).digest();
    const suppliedHash = createHash("sha256").update(supplied).digest();
    if (!supplied || !timingSafeEqual(expectedHash, suppliedHash))
      throw new UnauthorizedException();
    return true;
  }
}
