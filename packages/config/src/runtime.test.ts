import { describe, expect, it } from "vitest";

import { readApiConfig, readWorkerConfig } from "./runtime.js";

const base = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sale_advisor",
  REDIS_URL: "redis://localhost:6379",
  ADMIN_API_KEY: "test-admin-key-with-at-least-32-characters"
};

describe("runtime configuration", () => {
  it("uses safe development defaults", () => {
    expect(readApiConfig(base)).toMatchObject({
      nodeEnvironment: "development",
      apiPort: 3000,
      corsAllowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
      trustProxyHops: 0,
      rateLimitMax: 120,
      rateLimitWindowSeconds: 60,
      logLevel: "info"
    });
    expect(readWorkerConfig(base)).toMatchObject({
      nodeEnvironment: "development",
      notificationProvider: "fake",
      logLevel: "info"
    });
  });

  it("requires explicit production origins, proxy hops and notification provider", () => {
    const production = { ...base, NODE_ENV: "production" };
    expect(() => readApiConfig(production)).toThrow(/CORS_ALLOWED_ORIGINS/);
    expect(() =>
      readApiConfig({
        ...production,
        CORS_ALLOWED_ORIGINS: "https://admin.example.com",
        TRUST_PROXY_HOPS: "1"
      })
    ).not.toThrow();
    expect(() => readWorkerConfig(production)).toThrow(/NOTIFICATION_PROVIDER/);
    expect(() => readWorkerConfig({ ...production, NOTIFICATION_PROVIDER: "fake" })).not.toThrow();
  });

  it("rejects insecure production origins and placeholder admin keys without echoing secrets", () => {
    const secret = "short-secret";
    expect(() =>
      readApiConfig({
        ...base,
        NODE_ENV: "production",
        ADMIN_API_KEY: secret,
        CORS_ALLOWED_ORIGINS: "http://admin.example.com",
        TRUST_PROXY_HOPS: "1"
      })
    ).toThrowError(expect.not.stringContaining(secret));
  });

  it("validates bounded numeric settings", () => {
    expect(() => readApiConfig({ ...base, RATE_LIMIT_MAX: "0" })).toThrow(/RATE_LIMIT_MAX/);
    expect(() => readApiConfig({ ...base, TRUST_PROXY_HOPS: "4" })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it("rejects invalid environments, URLs, log levels, providers and origins", () => {
    expect(() => readApiConfig({ ...base, NODE_ENV: "invalid" })).toThrow(/NODE_ENV/);
    expect(() => readApiConfig({ ...base, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/
    );
    expect(() => readApiConfig({ ...base, REDIS_URL: "https://redis.example" })).toThrow(
      /REDIS_URL/
    );
    expect(() => readApiConfig({ ...base, LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
    expect(() => readWorkerConfig({ ...base, NOTIFICATION_PROVIDER: "email" })).toThrow(
      /NOTIFICATION_PROVIDER/
    );
    expect(() =>
      readApiConfig({
        ...base,
        NODE_ENV: "production",
        CORS_ALLOWED_ORIGINS: "http://admin.example.com",
        TRUST_PROXY_HOPS: "1"
      })
    ).toThrow(/CORS_ALLOWED_ORIGINS/);
  });
});
