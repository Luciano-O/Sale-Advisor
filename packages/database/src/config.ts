import { readCommonConfig } from "@sale-advisor/config";

export interface DatabaseConfig {
  databaseUrl: string;
  redisUrl: string;
  /** Connections per pool; each process may open several pools. */
  poolMax: number;
}

const DEFAULT_POOL_MAX = 10;
const MAX_POOL_MAX = 50;

export function readDatabaseConfig(
  environment: Record<string, string | undefined> = process.env
): DatabaseConfig {
  const { databaseUrl, redisUrl } = readCommonConfig(environment);
  return { databaseUrl, redisUrl, poolMax: readPoolMax(environment.DATABASE_POOL_MAX) };
}

function readPoolMax(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_POOL_MAX;
  const poolMax = Number(value);
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > MAX_POOL_MAX)
    throw new Error(`DATABASE_POOL_MAX must be an integer between 1 and ${MAX_POOL_MAX}`);
  return poolMax;
}
