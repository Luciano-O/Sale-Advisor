import { describe, expect, it, vi } from "vitest";

import { runMigrationSequence } from "./migration-runner.js";

describe("migration runner", () => {
  it("holds the advisory lock for the complete migration and closes afterwards", async () => {
    const calls: string[] = [];

    await runMigrationSequence({
      acquire: async () => void calls.push("acquire"),
      migrate: async () => void calls.push("migrate"),
      release: async () => void calls.push("release"),
      close: async () => void calls.push("close")
    });

    expect(calls).toEqual(["acquire", "migrate", "release", "close"]);
  });

  it("releases the lock and closes the database when migration fails", async () => {
    const failure = new Error("migration failed");
    const release = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);

    await expect(
      runMigrationSequence({
        acquire: async () => undefined,
        migrate: async () => {
          throw failure;
        },
        release,
        close
      })
    ).rejects.toBe(failure);

    expect(release).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not release a lock that was never acquired but still closes", async () => {
    const release = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);

    await expect(
      runMigrationSequence({
        acquire: async () => {
          throw new Error("lock failed");
        },
        migrate: async () => undefined,
        release,
        close
      })
    ).rejects.toThrow("lock failed");

    expect(release).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
});
