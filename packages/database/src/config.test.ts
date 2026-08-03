import { describe, expect, it } from "vitest";

import { readDatabaseConfig } from "./config.js";

describe("readDatabaseConfig", () => {
  it("reads explicit PostgreSQL and Redis URLs", () => {
    expect(
      readDatabaseConfig({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sale_advisor",
        REDIS_URL: "redis://localhost:6379"
      })
    ).toEqual({
      databaseUrl: "postgresql://postgres:postgres@localhost:5432/sale_advisor",
      redisUrl: "redis://localhost:6379"
    });
  });

  it("fails fast for missing or non-PostgreSQL database URLs", () => {
    expect(() => readDatabaseConfig({ REDIS_URL: "redis://localhost:6379" })).toThrow(
      /DATABASE_URL/
    );
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: "mysql://localhost/db", REDIS_URL: "redis://localhost" })
    ).toThrow(/PostgreSQL/);
  });
});
