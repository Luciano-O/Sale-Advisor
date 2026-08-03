export interface DatabaseConfig {
  databaseUrl: string;
  redisUrl: string;
}

export function readDatabaseConfig(
  environment: Record<string, string | undefined> = process.env
): DatabaseConfig {
  const databaseUrl = environment.DATABASE_URL;
  const redisUrl = environment.REDIS_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (!redisUrl?.startsWith("redis://") && !redisUrl?.startsWith("rediss://")) {
    throw new Error("REDIS_URL must use Redis");
  }
  return { databaseUrl, redisUrl };
}
