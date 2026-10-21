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
      redisUrl: "redis://localhost:6379",
      poolMax: 10
    });
  });

  it("limits connections per pool with DATABASE_POOL_MAX", () => {
    const base = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sale_advisor",
      REDIS_URL: "redis://localhost:6379"
    };
    expect(readDatabaseConfig({ ...base, DATABASE_POOL_MAX: "4" }).poolMax).toBe(4);
    for (const invalid of ["0", "-1", "2.5", "abc", "51"])
      expect(() => readDatabaseConfig({ ...base, DATABASE_POOL_MAX: invalid })).toThrow(
        /DATABASE_POOL_MAX/
      );
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
