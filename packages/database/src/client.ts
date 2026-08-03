import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readDatabaseConfig } from "./config.js";

export function createDatabase(environment: Record<string, string | undefined> = process.env) {
  const { databaseUrl } = readDatabaseConfig(environment);
  const client = postgres(databaseUrl, { max: 10 });
  const ormClient = postgres(databaseUrl, { max: 10 });
  const db = drizzle(ormClient);
  return {
    client,
    db,
    async close() {
      await Promise.all([client.end(), ormClient.end()]);
    }
  };
}

export function createDedicatedDatabaseConnection(
  environment: Record<string, string | undefined> = process.env
) {
  const { databaseUrl } = readDatabaseConfig(environment);
  const client = postgres(databaseUrl, { max: 1 });
  return {
    client,
    async close() {
      await client.end();
    }
  };
}
