import { randomUUID } from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

import type { OfferCache } from "./cache";
import type { PendingEventStore } from "./events";
import { hiddenOfferSnapshot, withOfferDefaults, type CachedOffer } from "./feed";
import { migratePreferences } from "./preferences";
import type {
  HiddenOffer,
  HiddenOfferSnapshot,
  LocalPreferences,
  MobileOffer,
  PendingEvent
} from "./types";

export type AppStateKey = "catalog" | "feed_last_viewed_at" | "feed_refreshed_at" | "stores";

export interface MobileDatabase {
  offerCache: OfferCache;
  pendingEvents: PendingEventStore;
  ensureInstallation(): Promise<string>;
  getPreferences(): Promise<LocalPreferences>;
  savePreferences(preferences: LocalPreferences): Promise<void>;
  getHiddenIds(): Promise<Set<string>>;
  hide(offer: MobileOffer): Promise<void>;
  hideSnapshot(id: string, snapshot: HiddenOfferSnapshot | null, hiddenAt?: string): Promise<void>;
  listHidden(): Promise<HiddenOffer[]>;
  unhide(id: string): Promise<void>;
  clearPendingEvents(): Promise<void>;
  /** Erases everything local; the next ensureInstallation creates a new code. */
  clearAll(): Promise<void>;
  getAppState(key: AppStateKey): Promise<string | null>;
  setAppState(key: AppStateKey, value: string): Promise<void>;
  enqueueEvent(event: Omit<PendingEvent, "id" | "attempts">): Promise<string>;
  wasNotificationShown(offerId: string): Promise<boolean>;
  markNotificationShown(offerId: string): Promise<void>;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

const LOCAL_TABLES = [
  "installation",
  "offer_cache",
  "preferences",
  "pending_events",
  "hidden_offers",
  "shown_notifications",
  "app_state"
];

export function createMobileDatabase(database: SQLiteDatabase): MobileDatabase {
  const hideSnapshot: MobileDatabase["hideSnapshot"] = async (
    id,
    snapshot,
    hiddenAt = new Date().toISOString()
  ) => {
    await database.runAsync(
      `INSERT INTO hidden_offers (id, hidden_at, payload) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET hidden_at = excluded.hidden_at, payload = excluded.payload`,
      id,
      hiddenAt,
      snapshot ? JSON.stringify(snapshot) : null
    );
  };
  return {
    offerCache: {
      async read() {
        const rows = await database.getAllAsync<{ payload: string }>(
          "SELECT payload FROM offer_cache ORDER BY refreshed_at DESC"
        );
        return rows.map(({ payload }) => withOfferDefaults(parseJson<CachedOffer>(payload)));
      },
      async replace(offers) {
        await database.withTransactionAsync(async () => {
          await database.runAsync("DELETE FROM offer_cache");
          const refreshedAt = new Date().toISOString();
          for (const offer of offers)
            await database.runAsync(
              "INSERT INTO offer_cache (id, payload, refreshed_at) VALUES (?, ?, ?)",
              offer.id,
              JSON.stringify(offer),
              refreshedAt
            );
        });
      }
    },
    pendingEvents: {
      async list(limit) {
        const rows = await database.getAllAsync<{ payload: string; attempts: number }>(
          "SELECT payload, attempts FROM pending_events ORDER BY created_at LIMIT ?",
          limit
        );
        return rows.map(({ payload, attempts }) => ({
          ...parseJson<Omit<PendingEvent, "attempts">>(payload),
          attempts
        }));
      },
      async remove(ids) {
        for (const id of ids)
          await database.runAsync("DELETE FROM pending_events WHERE id = ?", id);
      },
      async markFailed(ids, error) {
        for (const id of ids)
          await database.runAsync(
            "UPDATE pending_events SET attempts = attempts + 1, last_error = ? WHERE id = ?",
            error.slice(0, 1_000),
            id
          );
      }
    },
    async ensureInstallation() {
      const existing = await database.getFirstAsync<{ id: string }>(
        "SELECT id FROM installation WHERE singleton = 1"
      );
      if (existing) return existing.id;
      const id = randomUUID();
      await database.runAsync(
        "INSERT INTO installation (singleton, id, created_at) VALUES (1, ?, ?)",
        id,
        new Date().toISOString()
      );
      return id;
    },
    async getPreferences() {
      const row = await database.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM preferences WHERE singleton = 1"
      );
      return migratePreferences(row ? parseJson<unknown>(row.payload) : null);
    },
    async savePreferences(preferences) {
      await database.runAsync(
        `INSERT INTO preferences (singleton, payload, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(singleton) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        JSON.stringify(preferences),
        new Date().toISOString()
      );
    },
    async getHiddenIds() {
      const rows = await database.getAllAsync<{ id: string }>("SELECT id FROM hidden_offers");
      return new Set(rows.map(({ id }) => id));
    },
    async hide(offer) {
      await hideSnapshot(offer.id, hiddenOfferSnapshot(offer));
    },
    hideSnapshot,
    async listHidden() {
      const rows = await database.getAllAsync<{
        id: string;
        hidden_at: string;
        payload: string | null;
      }>("SELECT id, hidden_at, payload FROM hidden_offers ORDER BY hidden_at DESC");
      return rows.map(({ id, hidden_at, payload }) => ({
        id,
        hiddenAt: hidden_at,
        snapshot: payload ? parseJson<HiddenOfferSnapshot>(payload) : null
      }));
    },
    async unhide(id) {
      await database.runAsync("DELETE FROM hidden_offers WHERE id = ?", id);
    },
    async clearPendingEvents() {
      await database.runAsync("DELETE FROM pending_events");
    },
    async clearAll() {
      await database.withTransactionAsync(async () => {
        for (const table of LOCAL_TABLES) await database.runAsync(`DELETE FROM ${table}`);
      });
    },
    async getAppState(key) {
      const row = await database.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_state WHERE key = ?",
        key
      );
      return row?.value ?? null;
    },
    async setAppState(key, value) {
      await database.runAsync(
        `INSERT INTO app_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key,
        value
      );
    },
    async enqueueEvent(event) {
      const id = randomUUID();
      await database.runAsync(
        "INSERT INTO pending_events (id, payload, created_at) VALUES (?, ?, ?)",
        id,
        JSON.stringify({ ...event, id }),
        event.occurredAt
      );
      return id;
    },
    async wasNotificationShown(offerId) {
      return Boolean(
        await database.getFirstAsync<{ offer_id: string }>(
          "SELECT offer_id FROM shown_notifications WHERE offer_id = ?",
          offerId
        )
      );
    },
    async markNotificationShown(offerId) {
      await database.runAsync(
        "INSERT OR IGNORE INTO shown_notifications (offer_id, shown_at) VALUES (?, ?)",
        offerId,
        new Date().toISOString()
      );
    }
  };
}
