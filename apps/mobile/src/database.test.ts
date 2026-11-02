import { createRequire } from "node:module";

import type { SQLiteDatabase } from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMobileDatabase, type MobileDatabase } from "./database";
import { migrateDatabase } from "./migrations";
import type { MobileOffer } from "./types";

// Vite cannot resolve this built-in module through an import.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: Array<string | number>): unknown;
      all(...params: Array<string | number>): unknown[];
      run(...params: Array<string | number>): unknown;
    };
  };
};

let nextId = 0;
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++nextId}` }));

/** The real schema on real SQLite, behind the part of expo-sqlite that the app uses. */
async function openDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const adapter = {
    execAsync: async (sql: string) => void sqlite.exec(sql),
    getFirstAsync: async <T>(sql: string, ...params: string[]) =>
      (sqlite.prepare(sql).get(...params) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, ...params: Array<string | number>) =>
      sqlite.prepare(sql).all(...params) as T[],
    runAsync: async (sql: string, ...params: string[]) => sqlite.prepare(sql).run(...params),
    withTransactionAsync: async (run: () => Promise<void>) => {
      sqlite.exec("BEGIN");
      await run();
      sqlite.exec("COMMIT");
    }
  };
  await migrateDatabase(adapter);
  return createMobileDatabase(adapter as unknown as SQLiteDatabase);
}

const offer = {
  id: "offer-1",
  productId: "product-1",
  product: { category: "GPU", vendor: "NVIDIA", model: "RTX 5060", vramGb: 8 },
  store: { name: "KaBuM!", domain: "kabum.com.br" },
  effectivePriceCents: 189990
} as MobileOffer;
const snapshot = { name: "RTX 5060 8GB", storeName: "KaBuM!", priceCents: 189990 };

describe("local database", () => {
  let database: MobileDatabase;

  beforeEach(async () => {
    database = await openDatabase();
  });

  describe("hidden offers", () => {
    it("keeps a snapshot of the hidden offer", async () => {
      await database.hide(offer);

      const [hidden] = await database.listHidden();
      expect(hidden).toMatchObject({ id: "offer-1", snapshot });
      expect(await database.getHiddenIds()).toEqual(new Set(["offer-1"]));
    });

    it("lists the most recently hidden first", async () => {
      await database.hideSnapshot("older", snapshot, "2026-10-01T00:00:00.000Z");
      await database.hideSnapshot("newer", snapshot, "2026-10-02T00:00:00.000Z");

      expect((await database.listHidden()).map(({ id }) => id)).toEqual(["newer", "older"]);
    });

    it("lists an offer hidden before snapshots existed", async () => {
      await database.hideSnapshot("legacy", null, "2026-10-01T00:00:00.000Z");

      expect(await database.listHidden()).toEqual([
        { id: "legacy", hiddenAt: "2026-10-01T00:00:00.000Z", snapshot: null }
      ]);
    });

    it("shows one offer again and leaves the others hidden", async () => {
      await database.hideSnapshot("a", snapshot, "2026-10-01T00:00:00.000Z");
      await database.hideSnapshot("b", snapshot, "2026-10-01T00:00:00.000Z");

      await database.unhide("a");

      expect(await database.getHiddenIds()).toEqual(new Set(["b"]));
    });

    it("can hide the same offer twice, as a push action and the app may both do", async () => {
      await database.hide(offer);
      await database.hide(offer);

      expect(await database.listHidden()).toHaveLength(1);
    });
  });

  describe("clearAll", () => {
    it("erases everything local and starts a new installation", async () => {
      const before = await database.ensureInstallation();
      await database.hide(offer);
      await database.savePreferences({
        ...(await database.getPreferences()),
        onboardingCompleted: true
      });
      await database.offerCache.replace([offer]);
      await database.setAppState("catalog", "[]");
      await database.markNotificationShown("offer-1");
      await database.enqueueEvent({
        installationId: before,
        name: "app_opened",
        occurredAt: "2026-10-01T00:00:00.000Z"
      });

      await database.clearAll();

      expect(await database.ensureInstallation()).not.toBe(before);
      expect(await database.listHidden()).toEqual([]);
      expect((await database.getPreferences()).onboardingCompleted).toBe(false);
      expect(await database.offerCache.read()).toEqual([]);
      expect(await database.getAppState("catalog")).toBeNull();
      expect(await database.wasNotificationShown("offer-1")).toBe(false);
      expect(await database.pendingEvents.list(10)).toEqual([]);
    });
  });

  describe("pending events", () => {
    it("drops what was waiting to be sent", async () => {
      await database.enqueueEvent({
        installationId: "a",
        name: "app_opened",
        occurredAt: "2026-10-01T00:00:00.000Z"
      });

      await database.clearPendingEvents();

      expect(await database.pendingEvents.list(10)).toEqual([]);
    });
  });
});
