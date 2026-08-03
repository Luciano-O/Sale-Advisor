import { describe, expect, it, vi } from "vitest";

import {
  isCollectorHeartbeatAvailable,
  TelegramLeadershipCoordinator,
  type TelegramLeadershipStore
} from "./telegram-leadership.js";

class SharedLeadershipStore implements TelegramLeadershipStore {
  holder: string | null = null;
  roles = new Map<string, string>();
  heartbeats = new Map<string, Date>();

  async tryAcquire(instanceId: string) {
    if (this.holder && this.holder !== instanceId) return false;
    this.holder = instanceId;
    return true;
  }
  async update(instanceId: string, update: { role: "active" | "standby"; heartbeatAt: Date }) {
    this.roles.set(instanceId, update.role);
    this.heartbeats.set(instanceId, update.heartbeatAt);
  }
  async release(instanceId: string) {
    if (this.holder === instanceId) this.holder = null;
  }
}

describe("Telegram collector leadership", () => {
  it("elects exactly one active collector and keeps the other on standby", async () => {
    const store = new SharedLeadershipStore();
    const first = new TelegramLeadershipCoordinator("one", store);
    const second = new TelegramLeadershipCoordinator("two", store);
    await Promise.all([first.tick(), second.tick()]);
    expect([...store.roles.values()].sort()).toEqual(["active", "standby"]);
    expect([first.isActive, second.isActive].filter(Boolean)).toHaveLength(1);
  });

  it("allows failover after the active connection releases its advisory lock", async () => {
    const store = new SharedLeadershipStore();
    const first = new TelegramLeadershipCoordinator("one", store);
    const second = new TelegramLeadershipCoordinator("two", store);
    await first.tick();
    await second.tick();
    await first.stop();
    await second.tick();
    expect(second.isActive).toBe(true);
    expect(store.holder).toBe("two");
  });

  it("ticks at the configured 15 second cadence", async () => {
    vi.useFakeTimers();
    const store = new SharedLeadershipStore();
    const coordinator = new TelegramLeadershipCoordinator("one", store);
    coordinator.start();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(store.heartbeats.has("one")).toBe(true);
    await coordinator.stop();
    vi.useRealTimers();
  });

  it("considers heartbeats older than 45 seconds unavailable", () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    expect(isCollectorHeartbeatAvailable(new Date(now.getTime() - 45_000), now)).toBe(true);
    expect(isCollectorHeartbeatAvailable(new Date(now.getTime() - 45_001), now)).toBe(false);
    expect(isCollectorHeartbeatAvailable(null, now)).toBe(false);
  });
});
