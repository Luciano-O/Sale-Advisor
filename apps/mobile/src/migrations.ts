export const CURRENT_SCHEMA_VERSION = 1;

export interface MigrationDatabase {
  execAsync(sql: string): Promise<unknown>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
}

const INITIAL_SCHEMA = `
BEGIN;
CREATE TABLE IF NOT EXISTS installation (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offer_cache (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  refreshed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_events (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hidden_offers (
  id TEXT PRIMARY KEY,
  hidden_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shown_notifications (
  offer_id TEXT PRIMARY KEY,
  shown_at TEXT NOT NULL
);
PRAGMA user_version = 1;
COMMIT;`;

export async function migrateDatabase(database: MigrationDatabase): Promise<void> {
  await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  if (version > CURRENT_SCHEMA_VERSION)
    throw new Error(`Unsupported local schema version: ${version}`);
  if (version < 1) await database.execAsync(INITIAL_SCHEMA);
}
