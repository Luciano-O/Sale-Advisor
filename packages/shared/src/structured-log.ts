import { randomUUID } from "node:crypto";

export type StructuredLogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const LEVEL_RANK: Record<StructuredLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const SECRET_KEYS = ["key", "secret", "token", "session", "apihash", "messageText", "rawText"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createCorrelationId(value: unknown): string {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : randomUUID();
}

export function sanitizeLogContext(value: unknown, key = ""): unknown {
  const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
  if (SECRET_KEYS.some((candidate) => normalizedKey.includes(candidate.toLowerCase())))
    return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitizeLogContext(item));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeLogContext(entryValue, entryKey)
      ])
    );
  if (typeof value === "string" && normalizedKey.includes("url")) {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "[INVALID_URL]";
    }
  }
  return value;
}

export class JsonStructuredLogger {
  constructor(
    private readonly service: string,
    private readonly minimumLevel: StructuredLogLevel = "info",
    private readonly write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)
  ) {}

  debug(event: string, context: LogContext = {}) {
    this.emit("debug", event, context);
  }
  info(event: string, context: LogContext = {}) {
    this.emit("info", event, context);
  }
  warn(event: string, context: LogContext = {}) {
    this.emit("warn", event, context);
  }
  error(event: string, context: LogContext = {}) {
    this.emit("error", event, context);
  }

  private emit(level: StructuredLogLevel, event: string, context: LogContext) {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minimumLevel]) return;
    this.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        service: this.service,
        event,
        ...(sanitizeLogContext(context) as LogContext)
      })
    );
  }
}

export class NestCompatibleJsonLogger {
  constructor(private readonly logger: JsonStructuredLogger) {}
  log(_message: unknown, context?: string) {
    this.logger.info("framework.log", { component: context ?? "application" });
  }
  fatal(_message: unknown, context?: string) {
    this.logger.error("framework.fatal", { component: context ?? "application" });
  }
  error(_message: unknown, _stack?: string, context?: string) {
    this.logger.error("framework.error", { component: context ?? "application" });
  }
  warn(_message: unknown, context?: string) {
    this.logger.warn("framework.warn", { component: context ?? "application" });
  }
  debug(_message: unknown, context?: string) {
    this.logger.debug("framework.debug", { component: context ?? "application" });
  }
  verbose(_message: unknown, context?: string) {
    this.logger.debug("framework.verbose", { component: context ?? "application" });
  }
}
