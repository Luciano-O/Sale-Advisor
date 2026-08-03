const E2E_DATABASE_HOST = "127.0.0.1";
const E2E_DATABASE_PORT = "55432";
const E2E_REDIS_PORT = "56379";

export function assertSafeE2EEnvironment(
  environment: Record<string, string | undefined> = process.env
): void {
  if (environment.NODE_ENV !== "test") {
    throw new Error("Destructive E2E operations require NODE_ENV=test.");
  }

  const databaseUrl = new URL(environment.DATABASE_URL ?? "");
  if (!databaseUrl.pathname.endsWith("_e2e")) {
    throw new Error("E2E database name must end in _e2e (expected sale_advisor_e2e).");
  }
  if (databaseUrl.hostname !== E2E_DATABASE_HOST || databaseUrl.port !== E2E_DATABASE_PORT) {
    throw new Error("E2E PostgreSQL must use the exclusive endpoint 127.0.0.1:55432.");
  }

  const redisUrl = new URL(environment.REDIS_URL ?? "");
  if (redisUrl.hostname !== E2E_DATABASE_HOST || redisUrl.port !== E2E_REDIS_PORT) {
    throw new Error("E2E Redis must use the exclusive endpoint 127.0.0.1:56379.");
  }
}
