import { describe, expect, it, vi } from "vitest";

import { flushPendingEvents } from "./events";
import type { PendingEvent } from "./types";

const events: PendingEvent[] = [
  {
    id: "event-1",
    installationId: "install-1",
    name: "app_opened",
    occurredAt: "2026-07-14T12:00:00.000Z",
    attempts: 0
  }
];

describe("anonymous event queue", () => {
  it("removes events only after the backend accepts the batch", async () => {
    const store = {
      list: vi.fn(async () => events),
      remove: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined)
    };
    await expect(
      flushPendingEvents(
        store,
        vi.fn(async () => undefined)
      )
    ).resolves.toBe(1);
    expect(store.remove).toHaveBeenCalledWith(["event-1"]);
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it("keeps and increments attempts after a network failure", async () => {
    const store = {
      list: vi.fn(async () => events),
      remove: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined)
    };
    await expect(
      flushPendingEvents(
        store,
        vi.fn(async () => Promise.reject(new Error("offline")))
      )
    ).rejects.toThrow("offline");
    expect(store.markFailed).toHaveBeenCalledWith(["event-1"], "offline");
    expect(store.remove).not.toHaveBeenCalled();
  });
});
