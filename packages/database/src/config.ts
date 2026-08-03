import { readCommonConfig } from "@sale-advisor/config";

export interface DatabaseConfig {
  databaseUrl: string;
  redisUrl: string;
}

export function readDatabaseConfig(
  environment: Record<string, string | undefined> = process.env
): DatabaseConfig {
  const { databaseUrl, redisUrl } = readCommonConfig(environment);
  return { databaseUrl, redisUrl };
}
