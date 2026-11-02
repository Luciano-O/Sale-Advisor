import { describe, expect, it, vi } from "vitest";

import { CURRENT_SCHEMA_VERSION, migrateDatabase, type MigrationDatabase } from "./migrations";

describe("SQLite migrations", () => {
  it("creates every local store and records the current schema version", async () => {
    const execAsync = vi.fn(async () => undefined);
    const getFirstAsync = vi.fn(async () => ({ user_version: 0 }));
    const database = { execAsync, getFirstAsync } as MigrationDatabase;

    await migrateDatabase(database);

    const sql = execAsync.mock.calls.flat().join("\n");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS installation");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS offer_cache");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS preferences");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS pending_events");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS hidden_offers");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS shown_notifications");
    expect(sql).toContain(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  });

  it("upgrades an existing database without recreating its stores", async () => {
    const execAsync = vi.fn(async () => undefined);
    const database = {
      execAsync,
      getFirstAsync: vi.fn(async () => ({ user_version: 1 }))
    } as MigrationDatabase;

    await migrateDatabase(database);

    const sql = execAsync.mock.calls.flat().join("\n");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS app_state");
    expect(sql).toContain("ALTER TABLE hidden_offers ADD COLUMN payload TEXT");
    expect(sql).toContain("PRAGMA user_version = 2");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS installation");
  });

  it("builds a new database all the way to the current version, in order", async () => {
    const execAsync = vi.fn(async () => undefined);
    const database = {
      execAsync,
      getFirstAsync: vi.fn(async () => ({ user_version: 0 }))
    } as MigrationDatabase;

    await migrateDatabase(database);

    const sql = execAsync.mock.calls.flat().join("\n");
    expect(sql.indexOf("CREATE TABLE IF NOT EXISTS hidden_offers")).toBeLessThan(
      sql.indexOf("ALTER TABLE hidden_offers")
    );
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it("refuses a database newer than the app", async () => {
    const database = {
      execAsync: vi.fn(async () => undefined),
      getFirstAsync: vi.fn(async () => ({ user_version: CURRENT_SCHEMA_VERSION + 1 }))
    } as MigrationDatabase;

    await expect(migrateDatabase(database)).rejects.toThrow("Unsupported local schema version");
  });

  it("is idempotent when the database is already current", async () => {
    const execAsync = vi.fn(async () => undefined);
    const database = {
      execAsync,
      getFirstAsync: vi.fn(async () => ({ user_version: CURRENT_SCHEMA_VERSION }))
    } as MigrationDatabase;

    await migrateDatabase(database);

    expect(execAsync).toHaveBeenCalledOnce();
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining("PRAGMA foreign_keys = ON"));
  });
});
