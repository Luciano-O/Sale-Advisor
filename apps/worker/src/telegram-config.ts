export type TelegramConfig =
  | {
      enabled: false;
      initialHistoryLimit: number;
    }
  | {
      enabled: true;
      apiId: number;
      apiHash: string;
      session: string;
      chats: string[];
      initialHistoryLimit: number;
    };

export function readTelegramConfig(
  environment: Record<string, string | undefined> = process.env
): TelegramConfig {
  const enabled = environment.TELEGRAM_ENABLED?.trim().toLowerCase() === "true";
  const initialHistoryLimit = readHistoryLimit(environment.TELEGRAM_INITIAL_HISTORY_LIMIT);
  if (!enabled) return { enabled: false, initialHistoryLimit };

  const apiIdText = environment.TELEGRAM_API_ID?.trim();
  if (!apiIdText) throw new Error("TELEGRAM_API_ID is required when Telegram is enabled");
  const apiId = Number(apiIdText);
  if (!Number.isSafeInteger(apiId) || apiId <= 0) {
    throw new Error("TELEGRAM_API_ID must be a positive integer");
  }

  const apiHash = environment.TELEGRAM_API_HASH?.trim();
  if (!apiHash) throw new Error("TELEGRAM_API_HASH is required when Telegram is enabled");
  const session = environment.TELEGRAM_SESSION?.trim();
  if (!session) throw new Error("TELEGRAM_SESSION is required when Telegram is enabled");
  const chats = Array.from(
    new Set(
      (environment.TELEGRAM_CHATS ?? "")
        .split(",")
        .map((chat) => chat.trim())
        .filter(Boolean)
    )
  );
  if (chats.length === 0) {
    throw new Error("TELEGRAM_CHATS must contain at least one chat when Telegram is enabled");
  }

  return { enabled: true, apiId, apiHash, session, chats, initialHistoryLimit };
}

function readHistoryLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000) {
    throw new Error("TELEGRAM_INITIAL_HISTORY_LIMIT must be an integer between 0 and 1000");
  }
  return parsed;
}
