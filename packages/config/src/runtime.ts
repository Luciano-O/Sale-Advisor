export type NodeEnvironment = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface CommonRuntimeConfig {
  nodeEnvironment: NodeEnvironment;
  databaseUrl: string;
  redisUrl: string;
  logLevel: LogLevel;
}

export interface ApiRuntimeConfig extends CommonRuntimeConfig {
  apiPort: number;
  adminApiKey: string;
  corsAllowedOrigins: string[];
  trustProxyHops: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
}

export interface WorkerRuntimeConfig extends CommonRuntimeConfig {
  notificationProvider: "fake" | "fcm";
}

const LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function readApiConfig(
  environment: Record<string, string | undefined> = process.env
): ApiRuntimeConfig {
  const common = readCommonConfig(environment);
  const adminApiKey = required(environment, "ADMIN_API_KEY");
  if (
    adminApiKey.length < 32 ||
    (common.nodeEnvironment === "production" && /change-me/i.test(adminApiKey))
  )
    throw new Error("ADMIN_API_KEY must contain at least 32 non-placeholder characters");

  const originsText = environment.CORS_ALLOWED_ORIGINS?.trim();
  if (common.nodeEnvironment === "production" && !originsText)
    throw new Error("CORS_ALLOWED_ORIGINS is required in production");
  const corsAllowedOrigins = originsText
    ? originsText.split(",").map((value) => validateOrigin(value.trim(), common.nodeEnvironment))
    : LOCAL_ORIGINS;

  if (common.nodeEnvironment === "production" && environment.TRUST_PROXY_HOPS === undefined)
    throw new Error("TRUST_PROXY_HOPS is required in production");

  return {
    ...common,
    apiPort: apiPort(environment),
    adminApiKey,
    corsAllowedOrigins,
    trustProxyHops: integer(environment, "TRUST_PROXY_HOPS", 0, 0, 3),
    rateLimitMax: integer(environment, "RATE_LIMIT_MAX", 120, 1, 100_000),
    rateLimitWindowSeconds: integer(environment, "RATE_LIMIT_WINDOW_SECONDS", 60, 1, 3_600)
  };
}

export function readWorkerConfig(
  environment: Record<string, string | undefined> = process.env
): WorkerRuntimeConfig {
  const common = readCommonConfig(environment);
  const value = environment.NOTIFICATION_PROVIDER?.trim();
  if (common.nodeEnvironment === "production" && !value)
    throw new Error("NOTIFICATION_PROVIDER is required in production");
  if (value !== undefined && value !== "fake" && value !== "fcm")
    throw new Error("NOTIFICATION_PROVIDER must be fake or fcm");
  return { ...common, notificationProvider: value ?? "fake" };
}

export function readCommonConfig(
  environment: Record<string, string | undefined> = process.env
): CommonRuntimeConfig {
  const nodeEnvironment = environment.NODE_ENV?.trim() || "development";
  if (!isNodeEnvironment(nodeEnvironment)) throw new Error("NODE_ENV is invalid");
  const databaseUrl = validateUrl(
    required(environment, "DATABASE_URL"),
    ["postgres:", "postgresql:"],
    "DATABASE_URL must use PostgreSQL"
  );
  const redisUrl = validateUrl(
    required(environment, "REDIS_URL"),
    ["redis:", "rediss:"],
    "REDIS_URL must use Redis"
  );
  const logLevel = environment.LOG_LEVEL?.trim() || "info";
  if (!isLogLevel(logLevel)) throw new Error("LOG_LEVEL is invalid");
  return { nodeEnvironment, databaseUrl, redisUrl, logLevel };
}

function apiPort(environment: Record<string, string | undefined>): number {
  if (environment.API_PORT !== undefined) return integer(environment, "API_PORT", 3000, 1, 65_535);
  if (environment.PORT !== undefined) return integer(environment, "PORT", 3000, 1, 65_535);
  return 3000;
}

function required(environment: Record<string, string | undefined>, key: string): string {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function integer(
  environment: Record<string, string | undefined>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = environment[key];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
  return value;
}

function validateUrl(value: string, protocols: string[], errorMessage: string): string {
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) throw new Error();
    return value;
  } catch {
    throw new Error(errorMessage);
  }
}

function validateOrigin(value: string, nodeEnvironment: NodeEnvironment): string {
  try {
    const url = new URL(value);
    if (url.origin !== value || (nodeEnvironment === "production" && url.protocol !== "https:"))
      throw new Error();
    return value;
  } catch {
    throw new Error("CORS_ALLOWED_ORIGINS contains an invalid or insecure origin");
  }
}

function isNodeEnvironment(value: string): value is NodeEnvironment {
  return value === "development" || value === "test" || value === "production";
}

function isLogLevel(value: string): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}
