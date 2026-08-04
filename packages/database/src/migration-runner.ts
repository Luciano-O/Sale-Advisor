import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { createDatabase } from "./client.js";

const MIGRATION_LOCK_KEY = 83_625_793_729_113;

export interface MigrationSequence {
  acquire(): Promise<void>;
  migrate(): Promise<void>;
  release(): Promise<void>;
  close(): Promise<void>;
}

export async function runMigrationSequence(sequence: MigrationSequence): Promise<void> {
  let acquired = false;
  try {
    await sequence.acquire();
    acquired = true;
    await sequence.migrate();
  } finally {
    try {
      if (acquired) await sequence.release();
    } finally {
      await sequence.close();
    }
  }
}

export async function runMigrations(): Promise<void> {
  const connection = createDatabase();
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

  await runMigrationSequence({
    acquire: async () => {
      await connection.client`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    },
    migrate: async () => {
      await migrate(connection.db, { migrationsFolder });
    },
    release: async () => {
      await connection.client`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    },
    close: () => connection.close()
  });
}
