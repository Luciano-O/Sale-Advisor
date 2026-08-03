import { randomUUID } from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

import type { OfferCache } from "./cache";
import type { PendingEventStore } from "./events";
import {
  DEFAULT_PREFERENCES,
  type LocalPreferences,
  type MobileOffer,
  type PendingEvent
} from "./types";

export interface MobileDatabase {
  offerCache: OfferCache;
  pendingEvents: PendingEventStore;
  ensureInstallation(): Promise<string>;
  getPreferences(): Promise<LocalPreferences>;
  savePreferences(preferences: LocalPreferences): Promise<void>;
  getHiddenIds(): Promise<Set<string>>;
  hide(id: string): Promise<void>;
  enqueueEvent(event: Omit<PendingEvent, "id" | "attempts">): Promise<string>;
  wasNotificationShown(offerId: string): Promise<boolean>;
  markNotificationShown(offerId: string): Promise<void>;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function createMobileDatabase(database: SQLiteDatabase): MobileDatabase {
  return {
    offerCache: {
      async read() {
        const rows = await database.getAllAsync<{ payload: string }>(
          "SELECT payload FROM offer_cache ORDER BY refreshed_at DESC"
        );
        return rows.map(({ payload }) => parseJson<MobileOffer>(payload));
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
      return row ? parseJson<LocalPreferences>(row.payload) : DEFAULT_PREFERENCES;
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
    async hide(id) {
      await database.runAsync(
        "INSERT OR IGNORE INTO hidden_offers (id, hidden_at) VALUES (?, ?)",
        id,
        new Date().toISOString()
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
