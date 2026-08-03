import { describe, expect, it } from "vitest";

import { assertSafeE2EEnvironment } from "./e2e-safety.js";

const safeEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55432/sale_advisor_e2e",
  REDIS_URL: "redis://127.0.0.1:56379"
};

describe("assertSafeE2EEnvironment", () => {
  it("accepts only the dedicated E2E endpoints", () => {
    expect(() => assertSafeE2EEnvironment(safeEnvironment)).not.toThrow();
  });

  it.each([
    [{ ...safeEnvironment, NODE_ENV: "development" }, /NODE_ENV=test/],
    [
      {
        ...safeEnvironment,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/sale_advisor"
      },
      /sale_advisor_e2e/
    ],
    [
      {
        ...safeEnvironment,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/sale_advisor_e2e"
      },
      /127\.0\.0\.1:55432/
    ],
    [{ ...safeEnvironment, REDIS_URL: "redis://127.0.0.1:6379" }, /127\.0\.0\.1:56379/]
  ])("rejects unsafe E2E configuration: %o", (environment, expected) => {
    expect(() => assertSafeE2EEnvironment(environment)).toThrow(expected);
  });
});
