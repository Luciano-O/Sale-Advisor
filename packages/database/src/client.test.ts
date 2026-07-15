import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalRedisUrl = process.env.REDIS_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

describe("createDatabase", () => {
  it("creates a lazy PostgreSQL client and Drizzle database from an explicit environment", async () => {
    const database = createDatabase({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sale_advisor",
      REDIS_URL: "redis://localhost:6379"
    });

    expect(database.client).toBeTypeOf("function");
    expect(database.db).toBeDefined();
    await database.close();
  });

  it("uses process.env when no environment is provided", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/sale_advisor";
    process.env.REDIS_URL = "redis://localhost:6379";

    const database = createDatabase();

    expect(database.db).toBeDefined();
    await database.close();
  });
});
