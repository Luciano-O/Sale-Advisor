import { createDatabase } from "./client.js";

if (process.env.NODE_ENV === "production")
  throw new Error("Local rollback is disabled in production");
const connection = createDatabase();
const { client } = connection;
await client.unsafe(`
  drop schema if exists public cascade;
  create schema public;
  drop table if exists drizzle.__drizzle_migrations
`);
await connection.close();
