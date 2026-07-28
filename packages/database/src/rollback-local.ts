import { createDatabase } from "./client.js";
import { assertSafeE2EEnvironment } from "./e2e-safety.js";

assertSafeE2EEnvironment();
const connection = createDatabase();
const { client } = connection;
await client.unsafe(`
  drop schema if exists public cascade;
  create schema public;
  drop table if exists drizzle.__drizzle_migrations
`);
await connection.close();
