import { createDatabase } from "./client.js";

if (process.env.NODE_ENV === "production")
  throw new Error("Local rollback is disabled in production");
const { client } = createDatabase();
await client.unsafe("drop schema if exists public cascade; create schema public");
await client.end();
