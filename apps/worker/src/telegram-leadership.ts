export type CollectorRole = "active" | "standby";
export type CollectorState = "starting" | "healthy" | "retrying" | "blocked" | "stopped";

export interface CollectorInstanceUpdate {
  role: CollectorRole;
  heartbeatAt: Date;
  state?: CollectorState;
  lastMessageAt?: Date | null;
  retryCount?: number;
  nextRetryAt?: Date | null;
  lastError?: Record<string, unknown> | null;
}

export interface TelegramLeadershipStore {
  tryAcquire(instanceId: string): Promise<boolean>;
  update(instanceId: string, update: CollectorInstanceUpdate): Promise<void>;
  release(instanceId: string): Promise<void>;
}

export interface TelegramLeadershipOptions {
  intervalMs?: number;
  now?: () => Date;
  onRoleChanged?: (active: boolean) => Promise<void> | void;
}

export class TelegramLeadershipCoordinator {
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private active = false;
  private readonly intervalMs: number;
  private readonly now: () => Date;
  private readonly onRoleChanged?: TelegramLeadershipOptions["onRoleChanged"];

  constructor(
    private readonly instanceId: string,
    private readonly store: TelegramLeadershipStore,
    options: TelegramLeadershipOptions = {}
  ) {
    this.intervalMs = options.intervalMs ?? 15_000;
    this.now = options.now ?? (() => new Date());
    this.onRoleChanged = options.onRoleChanged;
  }

  get isActive() {
    return this.active;
  }

  start() {
    if (this.timer) return;
    void this.tick().catch(() => undefined);
    this.timer = setInterval(() => void this.tick().catch(() => undefined), this.intervalMs);
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const nextActive = await this.store.tryAcquire(this.instanceId);
      if (nextActive !== this.active) {
        this.active = nextActive;
        await this.onRoleChanged?.(nextActive);
      }
      await this.store.update(this.instanceId, {
        role: this.active ? "active" : "standby",
        heartbeatAt: this.now()
      });
    } catch (error) {
      if (this.active) {
        this.active = false;
        await this.onRoleChanged?.(false);
      }
      throw error;
    } finally {
      this.ticking = false;
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    delete this.timer;
    const wasActive = this.active;
    this.active = false;
    if (wasActive) await this.onRoleChanged?.(false);
    await this.store.release(this.instanceId);
  }
}

export function isCollectorHeartbeatAvailable(heartbeatAt: Date | null, now = new Date()) {
  return heartbeatAt !== null && now.getTime() - heartbeatAt.getTime() <= 45_000;
}
