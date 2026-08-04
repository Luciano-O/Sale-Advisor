import { describe, expect, it, vi } from "vitest";

import {
  createCorrelationId,
  JsonStructuredLogger,
  NestCompatibleJsonLogger,
  sanitizeLogContext
} from "./structured-log.js";

describe("structured logging", () => {
  it("preserves valid correlation UUIDs and replaces invalid values", () => {
    const valid = "f6a67f0f-e908-44c6-a3dc-4fbaa3438bdb";
    expect(createCorrelationId(valid)).toBe(valid);
    expect(createCorrelationId("not-a-uuid")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("redacts secrets, raw messages, tokens and URL query strings recursively", () => {
    const sanitized = sanitizeLogContext({
      adminApiKey: "secret",
      telegramSession: "session",
      pushToken: "token",
      messageText: "raw promotion",
      url: "https://shop.example/item?token=secret",
      safe: "value",
      nested: { apiHash: "hash" }
    });
    expect(sanitized).toEqual({
      adminApiKey: "[REDACTED]",
      telegramSession: "[REDACTED]",
      pushToken: "[REDACTED]",
      messageText: "[REDACTED]",
      url: "https://shop.example/item",
      safe: "value",
      nested: { apiHash: "[REDACTED]" }
    });
  });

  it("writes one JSON object with stable service and event fields", () => {
    const lines: string[] = [];
    const logger = new JsonStructuredLogger("api", "info", (line) => lines.push(line));
    logger.info("request.completed", { status: 200, adminApiKey: "secret" });
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      level: "info",
      service: "api",
      event: "request.completed",
      status: 200,
      adminApiKey: "[REDACTED]"
    });
  });

  it("honors levels and exposes every structured severity", () => {
    const lines: string[] = [];
    const logger = new JsonStructuredLogger("worker", "debug", (line) => lines.push(line));
    logger.debug("debug.event");
    logger.warn("warn.event");
    logger.error("error.event");
    expect(lines.map((line) => JSON.parse(line).level)).toEqual(["debug", "warn", "error"]);

    const filtered: string[] = [];
    const errorOnly = new JsonStructuredLogger("api", "error", (line) => filtered.push(line));
    errorOnly.info("ignored");
    expect(filtered).toHaveLength(0);
  });

  it("adapts framework severities without serializing framework messages", () => {
    const lines: string[] = [];
    const adapter = new NestCompatibleJsonLogger(
      new JsonStructuredLogger("api", "debug", (line) => lines.push(line))
    );
    adapter.log("sensitive message", "Router");
    adapter.fatal("sensitive message", "Bootstrap");
    adapter.error("sensitive message", "stack", "Handler");
    adapter.warn("sensitive message", "Guard");
    adapter.debug("sensitive message", "Module");
    adapter.verbose("sensitive message", "Module");
    expect(lines).toHaveLength(6);
    expect(lines.join("\n")).not.toContain("sensitive message");
  });

  it("uses stdout as the default sink", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    new JsonStructuredLogger("worker").info("worker.ready");
    expect(write).toHaveBeenCalledOnce();
    write.mockRestore();
  });
});
