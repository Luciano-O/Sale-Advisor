import { describe, expect, it } from "vitest";

import { readTelegramConfig } from "./telegram-config.js";

describe("readTelegramConfig", () => {
  it("keeps Telegram disabled without requiring credentials", () => {
    expect(readTelegramConfig({})).toEqual({
      enabled: false,
      initialHistoryLimit: 100
    });
  });

  it("validates and normalizes an enabled authorized-account configuration", () => {
    expect(
      readTelegramConfig({
        TELEGRAM_ENABLED: "true",
        TELEGRAM_API_ID: "123456",
        TELEGRAM_API_HASH: "hash-secret",
        TELEGRAM_SESSION: "session-secret",
        TELEGRAM_CHATS: " @ofertas, -1001234567890, @ofertas ",
        TELEGRAM_INITIAL_HISTORY_LIMIT: "25"
      })
    ).toEqual({
      enabled: true,
      apiId: 123456,
      apiHash: "hash-secret",
      session: "session-secret",
      chats: ["@ofertas", "-1001234567890"],
      initialHistoryLimit: 25
    });
  });

  it("fails fast for incomplete enabled configuration without exposing secret values", () => {
    expect(() =>
      readTelegramConfig({
        TELEGRAM_ENABLED: "true",
        TELEGRAM_API_HASH: "do-not-print",
        TELEGRAM_SESSION: "also-do-not-print"
      })
    ).toThrow("TELEGRAM_API_ID is required");

    try {
      readTelegramConfig({
        TELEGRAM_ENABLED: "true",
        TELEGRAM_API_ID: "invalid",
        TELEGRAM_API_HASH: "do-not-print",
        TELEGRAM_SESSION: "also-do-not-print",
        TELEGRAM_CHATS: "@ofertas"
      });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-print");
      expect(String(error)).not.toContain("also-do-not-print");
    }
  });
});
