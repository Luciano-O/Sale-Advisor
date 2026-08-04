export type TelegramFailureCategory =
  | "authentication_invalid"
  | "session_revoked"
  | "api_id_invalid"
  | "source_inaccessible"
  | "flood_wait"
  | "transient"
  | "unknown";

export interface TelegramFailure {
  category: TelegramFailureCategory;
  retry: "blocked" | "after" | "backoff";
  waitMs?: number;
  sanitizedError: { name: string; code?: string };
}

const BLOCKED_CODES: Record<string, TelegramFailureCategory> = {
  AUTH_KEY_INVALID: "authentication_invalid",
  AUTH_KEY_UNREGISTERED: "authentication_invalid",
  SESSION_EXPIRED: "session_revoked",
  SESSION_REVOKED: "session_revoked",
  USER_DEACTIVATED: "session_revoked",
  API_ID_INVALID: "api_id_invalid",
  API_ID_PUBLISHED_FLOOD: "api_id_invalid",
  CHANNEL_INVALID: "source_inaccessible",
  CHANNEL_PRIVATE: "source_inaccessible",
  CHAT_ADMIN_REQUIRED: "source_inaccessible",
  PEER_ID_INVALID: "source_inaccessible",
  USER_BANNED_IN_CHANNEL: "source_inaccessible"
};

const TRANSIENT_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "TIMEOUT"
]);

export function sanitizeTelegramError(error: unknown): { name: string; code?: string } {
  const value = asErrorRecord(error);
  const name =
    typeof value.name === "string" && value.name.length <= 80 ? value.name : "UnknownError";
  const code = readErrorCode(value);
  return { name, ...(code ? { code } : {}) };
}

export function classifyTelegramFailure(error: unknown): TelegramFailure {
  const value = asErrorRecord(error);
  const code = readErrorCode(value);
  const message = typeof value.message === "string" ? value.message.toUpperCase() : "";
  const floodSeconds = readFloodWaitSeconds(value, message);
  const sanitizedError = sanitizeTelegramError(error);
  if (floodSeconds !== null) {
    return {
      category: "flood_wait",
      retry: "after",
      waitMs: floodSeconds * 1_000,
      sanitizedError
    };
  }
  const blockedCategory = code ? BLOCKED_CODES[code] : undefined;
  if (blockedCategory) return { category: blockedCategory, retry: "blocked", sanitizedError };
  if (
    (code && TRANSIENT_CODES.has(code)) ||
    /(?:TIMEOUT|NETWORK|SOCKET|CONNECTION|SERVER_ERROR|INTERNAL)/.test(message)
  ) {
    return { category: "transient", retry: "backoff", sanitizedError };
  }
  return { category: "unknown", retry: "backoff", sanitizedError };
}

export function computeTelegramRetry(
  failure: TelegramFailure,
  consecutiveFailures: number,
  random: () => number = Math.random
): number | null {
  if (failure.retry === "blocked") return null;
  if (failure.category === "unknown" && consecutiveFailures >= 5) return null;
  const base =
    failure.retry === "after"
      ? (failure.waitMs ?? 0)
      : Math.min(2 ** Math.max(0, consecutiveFailures - 1) * 1_000, 60_000);
  return Math.round(base * (1 + Math.max(0, Math.min(1, random())) * 0.2));
}

function asErrorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : {};
}

function readErrorCode(value: Record<string, unknown>): string | undefined {
  const candidate = value.code ?? value.errorMessage;
  if (typeof candidate !== "string") return undefined;
  const normalized = candidate.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(normalized) ? normalized : undefined;
}

function readFloodWaitSeconds(value: Record<string, unknown>, message: string): number | null {
  const explicit = value.seconds;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 0) {
    return Math.ceil(explicit);
  }
  const matched = message.match(/FLOOD_WAIT_?(\d+)/)?.[1];
  return matched ? Number(matched) : null;
}
