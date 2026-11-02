import { describe, expect, it, vi } from "vitest";

import { flushPendingEvents, recordEvent } from "./events";
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

describe("recordEvent", () => {
  const event = {
    installationId: "installation-1",
    name: "app_opened" as const,
    occurredAt: "2026-10-29T12:00:00.000Z"
  };

  it("records while anonymous usage is on", async () => {
    const store = { enqueueEvent: vi.fn(async () => "id") };
    await expect(recordEvent(true, store, event)).resolves.toBe(true);
    expect(store.enqueueEvent).toHaveBeenCalledWith(event);
  });

  it("records nothing when anonymous usage is off", async () => {
    const store = { enqueueEvent: vi.fn(async () => "id") };
    await expect(recordEvent(false, store, event)).resolves.toBe(false);
    expect(store.enqueueEvent).not.toHaveBeenCalled();
  });
});
