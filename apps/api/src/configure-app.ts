import type { NestExpressApplication } from "@nestjs/platform-express";
import { createCorrelationId, type JsonStructuredLogger } from "@sale-advisor/shared";
import type { NextFunction, Request, Response } from "express";

const LOCAL_ADMIN_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export interface ApiHttpOptions {
  corsAllowedOrigins?: string[];
  trustProxyHops?: number;
  logger?: JsonStructuredLogger;
}

export function configureApiApp(app: NestExpressApplication, options: ApiHttpOptions = {}): void {
  app.set("trust proxy", options.trustProxyHops ?? 0);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const correlationId = createCorrelationId(request.header("x-correlation-id"));
    response.setHeader("x-correlation-id", correlationId);
    response.on("finish", () => {
      options.logger?.info("request.completed", {
        correlationId,
        method: request.method,
        route: request.route?.path ?? request.path,
        status: response.statusCode,
        durationMs: Date.now() - startedAt
      });
    });
    next();
  });
  app.enableCors({
    origin: options.corsAllowedOrigins ?? LOCAL_ADMIN_ORIGINS,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["content-type", "x-admin-key", "x-correlation-id"],
    exposedHeaders: ["x-correlation-id"]
  });
}
