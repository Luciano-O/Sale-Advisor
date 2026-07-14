import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readDatabaseConfig } from "./config.js";

export function createDatabase(environment: Record<string, string | undefined> = process.env) {
  const { databaseUrl } = readDatabaseConfig(environment);
  const client = postgres(databaseUrl, { max: 10 });
  return { client, db: drizzle(client) };
}
